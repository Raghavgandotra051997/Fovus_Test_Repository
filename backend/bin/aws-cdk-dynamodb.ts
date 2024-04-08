#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsCdkDynamodbStack } from '../lib/aws-cdk-dynamodb-stack';
import {S3UploadStack} from '../lib/S3-Upload-Stack';

// Initialize a new CDK application by creating an instance of the CDK App class.
// The CDK App is the root of the CDK construct tree and represents a CDK application.
const app = new cdk.App();

// Instantiate the AwsCdkDynamodbStack.
// This creates an AWS CloudFormation stack that includes AWS DynamoDB resources,
// and any other related resources defined within this stack.
new AwsCdkDynamodbStack(app, 'AwsCdkDynamodbStack');

// Instantiate the S3UploadStack.
// This creates another AWS CloudFormation stack focusing on Amazon S3 upload functionalities,
// Using this stack to upload script.sh to the S3 bucket
new S3UploadStack(app,'S3UploadStack');
