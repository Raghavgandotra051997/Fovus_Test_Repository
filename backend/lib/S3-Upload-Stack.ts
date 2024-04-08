import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import {aws_s3_deployment} from "aws-cdk-lib";
import {aws_lambda_event_sources, Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from "constructs";

//This stack is used to upload the script.sh file to 'fovusfrontendhosting6625d-dev' bucket.
// from where it is downloaded by Ec2 and executed
export class S3UploadStack extends Stack{
    constructor(scope: Construct, id: string, props?: StackProps){
        super(scope, id, props);

        const existingS3Bucket =s3.Bucket.fromBucketName(this,'ExistingBucketRef-dev','fovusfrontendhosting6625d-dev');
        new aws_s3_deployment.BucketDeployment(this,'DeployScript',{
            sources:[aws_s3_deployment.Source.asset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/scripts/')],
            destinationBucket:existingS3Bucket
        });
    }
}
