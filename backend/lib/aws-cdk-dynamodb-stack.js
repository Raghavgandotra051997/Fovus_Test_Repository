"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsCdkDynamodbStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const cdk = require("aws-cdk-lib/core");
const iam = require("aws-cdk-lib/aws-iam");
//This Stack include major resources for the Project(AWS DynamoDB, AWS LAMBDA,etc.)
class AwsCdkDynamodbStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        //Creating a DynamoDB Table with "id" as the partition-key
        //enabling the stream on this table as this will be triggering the lambda that sets up EC2
        const table = new dynamodb.Table(this, 'FileTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            tableName: 'fileTable',
            stream: dynamodb.StreamViewType.NEW_IMAGE
        });
        // Define AWS SDK layer, this layer is consumed by lambdas to consume aws-sdk libraries/features
        const awsSdkLayer = new lambda.LayerVersion(this, 'AwsSdkLayer', {
            code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/aws-sdk-layer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
            layerVersionName: 'aws-sdk-layer',
            description: 'A layer that conatins AWS SDK',
        });
        //Define Nanoid layer, this layer is consumed by updateDdbLambda to generate the nanoid
        const nanoidLayer = new lambda.LayerVersion(this, 'NanoidLayer', {
            code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/nanoid-layer'), // This folder should contain nodejs/node_modules/nanoid
            layerVersionName: 'nanoidLayer',
            compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
        });
        //lambda fucntion to update the DdbTable,triggered by REST API
        const updateDdbLambda = new lambda.Function(this, 'MyFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler', // handler code for lambda in index.js,function name(handler)
            code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/lambda/'),
            layers: [awsSdkLayer, nanoidLayer],
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        //permissions for updating the Ddb Table for "updateDdbLambda"
        table.grantWriteData(updateDdbLambda);
        // lambda being triggered from ddb stream(which means this will be triggered once there is an update in the DDb table)
        const dynamoDbStreamLambda = new lambda.Function(this, 'DynamoDbStreamLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'ddbStreamhandling.handler',
            code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/lambda/'),
            layers: [awsSdkLayer],
            environment: {
                TABLE_NAME: table.tableName
            }
        });
        //Since this lambda will be used to launch an EC2 instance, so adding a IAM role with policy 'AmazonEC2FullAccess'
        // and also added "RunInstance" and "TerminateInstance" to this lambda
        dynamoDbStreamLambda.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'));
        const ec2PermissionPolicy = new iam.PolicyStatement({
            actions: [
                "ec2:RunInstances",
                "ec2:TerminateInstances",
            ],
            resources: ["*"]
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
        dynamoDbStreamLambda.addEventSource(new aws_cdk_lib_1.aws_lambda_event_sources.DynamoEventSource(table, {
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
            effect: iam.Effect.ALLOW,
            actions: ['iam:PassRole'],
            resources: ['arn:aws:iam::471112532024:role/EC2S3AccessRole'],
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
        resource.addMethod('POST', integration);
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
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
        });
    }
}
exports.AwsCdkDynamodbStack = AwsCdkDynamodbStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLWNkay1keW5hbW9kYi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF3cy1jZGstZHluYW1vZGItc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkNBQWtGO0FBQ2xGLHFEQUFxRDtBQUNyRCxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELHdDQUF3QztBQUN4QywyQ0FBMkM7QUFJM0MsbUZBQW1GO0FBQ25GLE1BQWEsbUJBQW9CLFNBQVEsbUJBQUs7SUFDNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQjtRQUMxRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwwREFBMEQ7UUFDMUQsMEZBQTBGO1FBQzFGLE1BQU0sS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ2xELFlBQVksRUFBRSxFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFDO1lBQy9ELFNBQVMsRUFBRSxXQUFXO1lBQ3RCLE1BQU0sRUFBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFNBQVM7U0FDekMsQ0FBQyxDQUFDO1FBR0gsZ0dBQWdHO1FBQ2hHLE1BQU0sV0FBVyxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUMsYUFBYSxFQUFDO1lBQzdELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnRUFBZ0UsQ0FBQztZQUM3RixrQkFBa0IsRUFBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQy9DLGdCQUFnQixFQUFDLGVBQWU7WUFDaEMsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUFDLENBQUE7UUFFRix1RkFBdUY7UUFDdkYsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElB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QkFBa0IsRUFBRTtnQkFDbEIscURBQXFELEVBQUUsd0VBQXdFO2dCQUMvSCxxREFBcUQsRUFBRSxvQkFBb0I7Z0JBQzNFLG9EQUFvRCxFQUFFLEtBQUssRUFBRSw0Q0FBNEM7YUFDMUc7U0FDRixDQUFDO1FBRUYsMENBQTBDO1FBQzFDLHlGQUF5RjtRQUN6Rix5RkFBeUY7UUFDekYsZ0ZBQWdGO1FBQ2hGLFFBQVEsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLElBQUksVUFBVSxDQUFDLGVBQWUsQ0FBQztZQUMzRCxvQkFBb0IsRUFBRSxDQUFDLDBCQUEwQixDQUFDO1lBQ2xELG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLO1lBQ3pELGdCQUFnQixFQUFFO2dCQUNoQixrQkFBa0IsRUFBRSx1QkFBdUI7YUFDNUM7U0FDRixDQUFDLEVBQUU7WUFDRixlQUFlLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLG1EQUFtRDtTQUM5RixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFDLFFBQVEsRUFBQztZQUM5QixLQUFLLEVBQUMsR0FBRyxDQUFDLEdBQUc7U0FDZCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0S0Qsa0RBc0tDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHthd3NfbGFtYmRhX2V2ZW50X3NvdXJjZXMsIER1cmF0aW9uLCBTdGFjaywgU3RhY2tQcm9wc30gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliL2NvcmUnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLy9UaGlzIFN0YWNrIGluY2x1ZGUgbWFqb3IgcmVzb3VyY2VzIGZvciB0aGUgUHJvamVjdChBV1MgRHluYW1vREIsIEFXUyBMQU1CREEsZXRjLilcbmV4cG9ydCBjbGFzcyBBd3NDZGtEeW5hbW9kYlN0YWNrIGV4dGVuZHMgU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vQ3JlYXRpbmcgYSBEeW5hbW9EQiBUYWJsZSB3aXRoIFwiaWRcIiBhcyB0aGUgcGFydGl0aW9uLWtleVxuICAgIC8vZW5hYmxpbmcgdGhlIHN0cmVhbSBvbiB0aGlzIHRhYmxlIGFzIHRoaXMgd2lsbCBiZSB0cmlnZ2VyaW5nIHRoZSBsYW1iZGEgdGhhdCBzZXRzIHVwIEVDMlxuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdGaWxlVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHtuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR30sXG4gICAgICB0YWJsZU5hbWU6ICdmaWxlVGFibGUnLFxuICAgICAgc3RyZWFtOmR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19JTUFHRVxuICAgIH0pO1xuXG5cbiAgICAvLyBEZWZpbmUgQVdTIFNESyBsYXllciwgdGhpcyBsYXllciBpcyBjb25zdW1lZCBieSBsYW1iZGFzIHRvIGNvbnN1bWUgYXdzLXNkayBsaWJyYXJpZXMvZmVhdHVyZXNcbiAgICBjb25zdCBhd3NTZGtMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsJ0F3c1Nka0xheWVyJyx7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy9Vc2Vycy9yYWdoYXZnYW5kb3RyYS9Eb2N1bWVudHMvYXdzLWNkay1keW5hbW9kYi9hd3Mtc2RrLWxheWVyJyksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6W2xhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YXSxcbiAgICAgIGxheWVyVmVyc2lvbk5hbWU6J2F3cy1zZGstbGF5ZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdBIGxheWVyIHRoYXQgY29uYXRpbnMgQVdTIFNESycsXG4gICAgfSlcblxuICAgIC8vRGVmaW5lIE5hbm9pZCBsYXllciwgdGhpcyBsYXllciBpcyBjb25zdW1lZCBieSB1cGRhdGVEZGJMYW1iZGEgdG8gZ2VuZXJhdGUgdGhlIG5hbm9pZFxuICAgIGNvbnN0IG5hbm9pZExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ05hbm9pZExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcvVXNlcnMvcmFnaGF2Z2FuZG90cmEvRG9jdW1lbnRzL2F3cy1jZGstZHluYW1vZGIvbmFub2lkLWxheWVyJyksIC8vIFRoaXMgZm9sZGVyIHNob3VsZCBjb250YWluIG5vZGVqcy9ub2RlX21vZHVsZXMvbmFub2lkXG4gICAgICBsYXllclZlcnNpb25OYW1lOiduYW5vaWRMYXllcicsXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWF0sXG4gICAgfSk7XG5cblxuICAgIC8vbGFtYmRhIGZ1Y250aW9uIHRvIHVwZGF0ZSB0aGUgRGRiVGFibGUsdHJpZ2dlcmVkIGJ5IFJFU1QgQVBJXG4gICAgY29uc3QgdXBkYXRlRGRiTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTXlGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLCAvLyBoYW5kbGVyIGNvZGUgZm9yIGxhbWJkYSBpbiBpbmRleC5qcyxmdW5jdGlvbiBuYW1lKGhhbmRsZXIpXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy9Vc2Vycy9yYWdoYXZnYW5kb3RyYS9Eb2N1bWVudHMvYXdzLWNkay1keW5hbW9kYi9sYW1iZGEvJyksXG4gICAgICBsYXllcnM6W2F3c1Nka0xheWVyLG5hbm9pZExheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvL3Blcm1pc3Npb25zIGZvciB1cGRhdGluZyB0aGUgRGRiIFRhYmxlIGZvciBcInVwZGF0ZURkYkxhbWJkYVwiXG4gICAgdGFibGUuZ3JhbnRXcml0ZURhdGEodXBkYXRlRGRiTGFtYmRhKTtcblxuXG4gICAgLy8gbGFtYmRhIGJlaW5nIHRyaWdnZXJlZCBmcm9tIGRkYiBzdHJlYW0od2hpY2ggbWVhbnMgdGhpcyB3aWxsIGJlIHRyaWdnZXJlZCBvbmNlIHRoZXJlIGlzIGFuIHVwZGF0ZSBpbiB0aGUgRERiIHRhYmxlKVxuICAgIGNvbnN0IGR5bmFtb0RiU3RyZWFtTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCdEeW5hbW9EYlN0cmVhbUxhbWJkYScse1xuICAgICAgcnVudGltZTpsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6J2RkYlN0cmVhbWhhbmRsaW5nLmhhbmRsZXInLFxuICAgICAgY29kZTpsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy9Vc2Vycy9yYWdoYXZnYW5kb3RyYS9Eb2N1bWVudHMvYXdzLWNkay1keW5hbW9kYi9sYW1iZGEvJyksXG4gICAgICBsYXllcnM6W2F3c1Nka0xheWVyXSxcbiAgICAgIGVudmlyb25tZW50OntcbiAgICAgICAgVEFCTEVfTkFNRTp0YWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vU2luY2UgdGhpcyBsYW1iZGEgd2lsbCBiZSB1c2VkIHRvIGxhdW5jaCBhbiBFQzIgaW5zdGFuY2UsIHNvIGFkZGluZyBhIElBTSByb2xlIHdpdGggcG9saWN5ICdBbWF6b25FQzJGdWxsQWNjZXNzJ1xuICAgIC8vIGFuZCBhbHNvIGFkZGVkIFwiUnVuSW5zdGFuY2VcIiBhbmQgXCJUZXJtaW5hdGVJbnN0YW5jZVwiIHRvIHRoaXMgbGFtYmRhXG4gICAgZHluYW1vRGJTdHJlYW1MYW1iZGEucm9sZT8uYWRkTWFuYWdlZFBvbGljeShpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvbkVDMkZ1bGxBY2Nlc3MnKSk7XG4gICAgY29uc3QgZWMyUGVybWlzc2lvblBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6W1xuICAgICAgICBcImVjMjpSdW5JbnN0YW5jZXNcIixcbiAgICAgICAgXCJlYzI6VGVybWluYXRlSW5zdGFuY2VzXCIsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOltcIipcIl1cbiAgICB9KTtcblxuICAgIC8vIERlZmluZSBhIG5ldyBwb2xpY3kgc3RhdGVtZW50IHRoYXQgZ3JhbnRzIGFjY2VzcyB0byBEeW5hbW9EQiBvcGVyYXRpb25zXG4gICAgY29uc3QgZHluYW1vRGJQZXJtaXNzaW9uUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICBcImR5bmFtb2RiOlB1dEl0ZW1cIixcbiAgICAgICAgXCJkeW5hbW9kYjpHZXRJdGVtXCIsXG4gICAgICAgIFwiZHluYW1vZGI6VXBkYXRlSXRlbVwiLFxuICAgICAgICBcImR5bmFtb2RiOlF1ZXJ5XCIsXG4gICAgICAgIFwiZHluYW1vZGI6U2NhblwiLFxuICAgICAgICBcImR5bmFtb2RiOkRlbGV0ZUl0ZW1cIlxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3RhYmxlLnRhYmxlQXJuXSAvLyBBUk4gb2YgdGhlIEREQiB0YWJsZVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIER5bmFtb0RCZXZlbnQgYXMgYW4gZXZlbnQgc291cmNlIGZvciB0aGUgTGFtYmRhIGZ1bmN0aW9uXG4gICAgZHluYW1vRGJTdHJlYW1MYW1iZGEuYWRkRXZlbnRTb3VyY2UobmV3IGF3c19sYW1iZGFfZXZlbnRfc291cmNlcy5EeW5hbW9FdmVudFNvdXJjZSh0YWJsZSx7XG4gICAgICBzdGFydGluZ1Bvc2l0aW9uOiBsYW1iZGEuU3RhcnRpbmdQb3NpdGlvbi5UUklNX0hPUklaT04sXG4gICAgICBiYXRjaFNpemU6IDUsXG4gICAgICBiaXNlY3RCYXRjaE9uRXJyb3I6IHRydWUsXG4gICAgICByZXRyeUF0dGVtcHRzOiAyLFxuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICB9KSk7XG5cbiAgICAvL0FkZCBFQzIgYW5kIER5bmFtb0RCIGFjY2VzcyBwb2xpY2llcyB0byB0aGUgZHluYW1vRGJTdHJlYW1MYW1iZGEgbGFtYmRhXG4gICAgZHluYW1vRGJTdHJlYW1MYW1iZGEuYWRkVG9Sb2xlUG9saWN5KGVjMlBlcm1pc3Npb25Qb2xpY3kpO1xuICAgIGR5bmFtb0RiU3RyZWFtTGFtYmRhLmFkZFRvUm9sZVBvbGljeShkeW5hbW9EYlBlcm1pc3Npb25Qb2xpY3kpO1xuXG4gICAgLy8gU2luY2UgdGhpcyBsYW1iZGEgaXMgdXNlZCBsYXVuY2ggYW4gRWMyIHdoaWNoIGluIHR1cm4gZG93bmxvYWQgZmlsZXMgZnJvbSBTMyBidWNrZXQsXG4gICAgLy8gYW4gSUFNIHJvbGUgJ0VDMlMzQWNjZXNzUm9sZScgaXMgY3JlYXRlZCBhbmQgcGFzc2VkIHRvIHRoZSBFYzIgYnkgdGhpcyBsYW1iZGEgYXQgdGltZSB0aGlzIGlzIGxhdW5jaGVkXG4gICAgZHluYW1vRGJTdHJlYW1MYW1iZGEucm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OmlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOlsnaWFtOlBhc3NSb2xlJ10sXG4gICAgICByZXNvdXJjZXM6Wydhcm46YXdzOmlhbTo6NDcxMTEyNTMyMDI0OnJvbGUvRUMyUzNBY2Nlc3NSb2xlJ10sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdpYW06UGFzc2VkVG9TZXJ2aWNlJzogJ2VjMi5hbWF6b25hd3MuY29tJyxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKTtcbiAgICAvL1JlYWRpbmcgdGhlIHN0cmVhbSBjb21pbmcgZnJvbSBEZGIgdGFibGVcbiAgICB0YWJsZS5ncmFudFN0cmVhbVJlYWQoZHluYW1vRGJTdHJlYW1MYW1iZGEpO1xuXG4gICAgLy8gQ3JlYXRpbmcgYSBSRVNUIEFQSSB0byBoYW5kbGUgdGhlIHJlcXVlc3QgY29taW5nIGZyb20gZnJvbnRlbmRcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdMb2FkQmFsYW5jZUFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnU2VydmljZSdcbiAgICB9KTtcblxuICAgIC8vIEFkZGluZyBhIHJlc291cmNlICdkYXRhJyB0byB0aGUgQVBJIGFuZCBpbnRlZ3JhdGluZyBpdCB3aWggJ3VwZGF0ZURkYkxhbWJkYScsIG1lYW5zIHRoaXMgQVBJXG4gICAgLy9TZXJ2ZXMgYSB0cmlnZ2VyIHRvIHRoZSAndXBkYXRlRGRiTGFtYmRhJyBMYW1iZGFcbiAgICBjb25zdCByZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdkYXRhJyk7XG4gICAgY29uc3QgaW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1cGRhdGVEZGJMYW1iZGEpO1xuICAgIC8vQWRkaW5nIFBPU1QgbWV0aG9kIHRvIHRoZSBSZXNvdXJjZVxuICAgIHJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsaW50ZWdyYXRpb24pXG5cblxuICAgIC8vIERlZmluZSB0aGUgcmVzcG9uc2Ugc3RydWN0dXJlIGZvciB0aGUgT1BUSU9OUyBtZXRob2QgY2FsbFxuICAgIC8vIFRoaXMgc3RydWN0dXJlIG91dGxpbmVzIGhvdyB0aGUgQVBJIEdhdGV3YXkgc2hvdWxkIHJlc3BvbmQgdG8gdGhlIGNsaWVudCB3aXRoIEhUVFAgMjAwIHN0YXR1cyBjb2RlXG4gICAgLy8gYW5kIHNwZWNpZmllcyB0aGF0IGNlcnRhaW4gaGVhZGVycyBhcmUgYWxsb3dlZCBpbiB0aGUgcmVzcG9uc2UuXG4gICAgY29uc3Qgb3B0aW9uc01ldGhvZFJlc3BvbnNlID0ge1xuICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAvLyBJbmRpY2F0ZSB0aGF0IHRoZXNlIGhlYWRlcnMgYXJlIGFsbG93ZWQgaW4gdGhlIHJlc3BvbnNlXG4gICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWUsXG4gICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxuICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxuICAgICAgfSxcbiAgICB9O1xuXG5cbiAgICAvLyBEZWZpbmUgdGhlIGFjdHVhbCB2YWx1ZXMgZm9yIHRoZSBoZWFkZXJzIHRoYXQgd2lsbCBiZSByZXR1cm5lZCBpbiB0aGUgT1BUSU9OUyBtZXRob2QgcmVzcG9uc2UuXG4gICAgLy8gVGhpcyBpbmNsdWRlcyBzcGVjaWZ5aW5nIHdoaWNoIHJlcXVlc3QgaGVhZGVycyBhcmUgYWxsb3dlZCwgd2hpY2ggSFRUUCBtZXRob2RzIGFyZSBzdXBwb3J0ZWQgZm9yIENPUlMsXG4gICAgLy8gYW5kIHRoZSBhbGxvd2VkIG9yaWdpbiBkb21haW5zICh1c2UgJyonIGZvciBhbGxvd2luZyBhbnkgZG9tYWluIG9yIHNwZWNpZnkgZG9tYWlucyBmb3IgdGlnaHRlciBzZWN1cml0eSkuXG4gICAgY29uc3Qgb3B0aW9uc0ludGVncmF0aW9uUmVzcG9uc2UgPSB7XG4gICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgIC8vIFNwZWNpZnkgdGhlIGFjdHVhbCBoZWFkZXIgdmFsdWVzIHRvIHJldHVyblxuICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsWC1BbXotRGF0ZSxBdXRob3JpemF0aW9uLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcbiAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ09QVElPTlMsUE9TVCxHRVQnXCIsXG4gICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCIsIC8vU2hvdWxkIGJlIGNoYW5nZWQgd2hlbiB1c2VkIGZvciBwcm9kdWN0aW9uXG4gICAgICB9LFxuICAgIH07XG5cbiAgICAvLyBBZGQgdGhlIE9QVElPTlMgbWV0aG9kIHRvIHRoZSByZXNvdXJjZS5cbiAgICAvLyBUaGlzIHNldHVwIHVzZXMgYSBNb2NrSW50ZWdyYXRpb24gdG8gYXV0b21hdGljYWxseSByZXNwb25kIHRvIE9QVElPTlMgcmVxdWVzdHMgd2l0aG91dFxuICAgIC8vIGZvcndhcmRpbmcgdGhlIHJlcXVlc3QgdG8gYW55IGJhY2tlbmQuIFRoaXMgaXMgZXNzZW50aWFsIGZvciBpbXBsZW1lbnRpbmcgQ09SUyBzdXBwb3J0XG4gICAgLy8gYnkgaW5mb3JtaW5nIHRoZSBjbGllbnQgYWJvdXQgdGhlIGFsbG93ZWQgb3JpZ2lucywgaGVhZGVycywgYW5kIEhUVFAgbWV0aG9kcy5cbiAgICByZXNvdXJjZS5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ2F0ZXdheS5Nb2NrSW50ZWdyYXRpb24oe1xuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtvcHRpb25zSW50ZWdyYXRpb25SZXNwb25zZV0sXG4gICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiBhcGlnYXRld2F5LlBhc3N0aHJvdWdoQmVoYXZpb3IuTkVWRVIsXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiOiBcIntcXFwic3RhdHVzQ29kZVxcXCI6IDIwMH1cIlxuICAgICAgfVxuICAgIH0pLCB7XG4gICAgICBtZXRob2RSZXNwb25zZXM6IFtvcHRpb25zTWV0aG9kUmVzcG9uc2VdLCAvLyBOb3RlIHRoYXQgaGVyZSB3ZSdyZSB1c2luZyBvcHRpb25zTWV0aG9kUmVzcG9uc2VcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsJ0FwaVVybCcse1xuICAgICAgdmFsdWU6YXBpLnVybCxcbiAgICB9KTtcbiAgfVxufVxuIl19