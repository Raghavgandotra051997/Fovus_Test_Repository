import {aws_lambda_event_sources, Duration, Stack, StackProps} from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';

import { Construct } from 'constructs';

//This Stack include major resources for the Project(AWS DynamoDB, AWS LAMBDA,etc.)
export class AwsCdkDynamodbStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    //Creating a DynamoDB Table with "id" as the partition-key
    //enabling the stream on this table as this will be triggering the lambda that sets up EC2
    const table = new dynamodb.Table(this, 'FileTable', {
      partitionKey: {name: 'id', type: dynamodb.AttributeType.STRING},
      tableName: 'fileTable',
      stream:dynamodb.StreamViewType.NEW_IMAGE
    });


    // Define AWS SDK layer, this layer is consumed by lambdas to consume aws-sdk libraries/features
    const awsSdkLayer = new lambda.LayerVersion(this,'AwsSdkLayer',{
      code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/aws-sdk-layer'),
      compatibleRuntimes:[lambda.Runtime.NODEJS_20_X],
      layerVersionName:'aws-sdk-layer',
      description: 'A layer that conatins AWS SDK',
    })

    //Define Nanoid layer, this layer is consumed by updateDdbLambda to generate the nanoid
    const nanoidLayer = new lambda.LayerVersion(this, 'NanoidLayer', {
      code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/nanoid-layer'), // This folder should contain nodejs/node_modules/nanoid
      layerVersionName:'nanoidLayer',
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
    });


    //lambda fucntion to update the DdbTable,triggered by REST API
    const updateDdbLambda = new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler', // handler code for lambda in index.js,function name(handler)
      code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/lambda/'),
      layers:[awsSdkLayer,nanoidLayer],
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    //permissions for updating the Ddb Table for "updateDdbLambda"
    table.grantWriteData(updateDdbLambda);


    // lambda being triggered from ddb stream(which means this will be triggered once there is an update in the DDb table)
    const dynamoDbStreamLambda = new lambda.Function(this,'DynamoDbStreamLambda',{
      runtime:lambda.Runtime.NODEJS_20_X,
      handler:'ddbStreamhandling.handler',
      code:lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/lambda/'),
      layers:[awsSdkLayer],
      environment:{
        TABLE_NAME:table.tableName
      }
    });

    //Since this lambda will be used to launch an EC2 instance, so adding a IAM role with policy 'AmazonEC2FullAccess'
    // and also added "RunInstance" and "TerminateInstance" to this lambda
    dynamoDbStreamLambda.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'));
    const ec2PermissionPolicy = new iam.PolicyStatement({
      actions:[
        "ec2:RunInstances",
        "ec2:TerminateInstances",
      ],
      resources:["*"]
    });

    // Define a new policy statement that grants access to DynamoDB operations
    const dynamoDbPermissionPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:DeleteItem"
      ],
      resources: [table.tableArn] // ARN of the DDB table
    });

    // Add DynamoDBevent as an event source for the Lambda function
    dynamoDbStreamLambda.addEventSource(new aws_lambda_event_sources.DynamoEventSource(table,{
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 5,
      bisectBatchOnError: true,
      retryAttempts: 2,
      enabled: true,
    }));

    //Add EC2 and DynamoDB access policies to the dynamoDbStreamLambda lambda
    dynamoDbStreamLambda.addToRolePolicy(ec2PermissionPolicy);
    dynamoDbStreamLambda.addToRolePolicy(dynamoDbPermissionPolicy);

    // Since this lambda is used launch an Ec2 which in turn download files from S3 bucket,
    // an IAM role 'EC2S3AccessRole' is created and passed to the Ec2 by this lambda at time this is launched
    dynamoDbStreamLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      effect:iam.Effect.ALLOW,
      actions:['iam:PassRole'],
      resources:['arn:aws:iam::471112532024:role/EC2S3AccessRole'],
      conditions: {
        StringEquals: {
          'iam:PassedToService': 'ec2.amazonaws.com',
        }
      }
    }));
    //Reading the stream coming from Ddb table
    table.grantStreamRead(dynamoDbStreamLambda);

    // Creating a REST API to handle the request coming from frontend
    const api = new apigateway.RestApi(this, 'LoadBalanceApi', {
      restApiName: 'Service'
    });

    // Adding a resource 'data' to the API and integrating it wih 'updateDdbLambda', means this API
    //Serves a trigger to the 'updateDdbLambda' Lambda
    const resource = api.root.addResource('data');
    const integration = new apigateway.LambdaIntegration(updateDdbLambda);
    //Adding POST method to the Resource
    resource.addMethod('POST',integration)


    // Define the response structure for the OPTIONS method call
    // This structure outlines how the API Gateway should respond to the client with HTTP 200 status code
    // and specifies that certain headers are allowed in the response.
    const optionsMethodResponse = {
      statusCode: '200',
      // Indicate that these headers are allowed in the response
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    };


    // Define the actual values for the headers that will be returned in the OPTIONS method response.
    // This includes specifying which request headers are allowed, which HTTP methods are supported for CORS,
    // and the allowed origin domains (use '*' for allowing any domain or specify domains for tighter security).
    const optionsIntegrationResponse = {
      statusCode: '200',
      // Specify the actual header values to return
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST,GET'",
        'method.response.header.Access-Control-Allow-Origin': "'*'", //Should be changed when used for production
      },
    };

    // Add the OPTIONS method to the resource.
    // This setup uses a MockIntegration to automatically respond to OPTIONS requests without
    // forwarding the request to any backend. This is essential for implementing CORS support
    // by informing the client about the allowed origins, headers, and HTTP methods.
    resource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [optionsIntegrationResponse],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": "{\"statusCode\": 200}"
      }
    }), {
      methodResponses: [optionsMethodResponse], // Note that here we're using optionsMethodResponse
    });

    new cdk.CfnOutput(this,'ApiUrl',{
      value:api.url,
    });
  }
}
