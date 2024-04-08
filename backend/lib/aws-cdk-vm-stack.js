"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDbStreamLambdaStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
class DynamoDbStreamLambdaStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const fileTable = new dynamodb.Table(this, 'FileTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            tableName: 'fileTable',
            stream: dynamodb.StreamViewType.NEW_IMAGE
        });
        //Lambbda function
        const dynamoDbStreamLambda = new lambda.Function(this, 'DynamoDbStreamLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'ddbStreamhandling.handler',
            code: lambda.Code.fromAsset('/Users/raghavgandotra/Documents/aws-cdk-dynamodb/lambda/'),
            environment: {
                TABLE_NAME: fileTable.tableName,
            }
        });
        dynamoDbStreamLambda.addEventSource(new aws_cdk_lib_1.aws_lambda_event_sources.DynamoEventSource(fileTable, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 5,
            bisectBatchOnError: true,
            retryAttempts: 2,
            enabled: true,
        }));
        fileTable.grantStreamRead(dynamoDbStreamLambda);
    }
}
exports.DynamoDbStreamLambdaStack = DynamoDbStreamLambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLWNkay12bS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF3cy1jZGstdm0tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkNBQWtGO0FBQ2xGLHFEQUFxRDtBQUNyRCxpREFBaUQ7QUFPakQsTUFBYSx5QkFBMEIsU0FBUSxtQkFBSztJQUNoRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQ3hELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sU0FBUyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUMsV0FBVyxFQUFDO1lBQ2xELFlBQVksRUFBQyxFQUFDLElBQUksRUFBQyxJQUFJLEVBQUMsSUFBSSxFQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFDO1lBQzNELFNBQVMsRUFBQyxXQUFXO1lBQ3JCLE1BQU0sRUFBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFNBQVM7U0FDdkMsQ0FDSixDQUFDO1FBRUYsa0JBQWtCO1FBQ2xCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBQyxzQkFBc0IsRUFBQztZQUMxRSxPQUFPLEVBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ2xDLE9BQU8sRUFBQywyQkFBMkI7WUFDbkMsSUFBSSxFQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLDBEQUEwRCxDQUFDO1lBQ3RGLFdBQVcsRUFBQztnQkFDUixVQUFVLEVBQUMsU0FBUyxDQUFDLFNBQVM7YUFDakM7U0FDSCxDQUFDLENBQUM7UUFFSCxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsSUFBSSxzQ0FBd0IsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUM7WUFDekYsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFlBQVk7WUFDdEQsU0FBUyxFQUFFLENBQUM7WUFDWixrQkFBa0IsRUFBRSxJQUFJO1lBQ3hCLGFBQWEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sRUFBRSxJQUFJO1NBQ2hCLENBQUMsQ0FBQyxDQUFDO1FBRUosU0FBUyxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFBO0lBQ25ELENBQUM7Q0FDSjtBQS9CRCw4REErQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2F3c19sYW1iZGFfZXZlbnRfc291cmNlcywgRHVyYXRpb24sIFN0YWNrLCBTdGFja1Byb3BzfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWIvY29yZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIER5bmFtb0RiU3RyZWFtTGFtYmRhU3RhY2sgZXh0ZW5kcyBTdGFja3tcbiAgICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWNrUHJvcHMpe1xuICAgICAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgICAgICBjb25zdCBmaWxlVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywnRmlsZVRhYmxlJyx7XG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6e25hbWU6J2lkJyx0eXBlOmR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HfSxcbiAgICAgICAgICAgIHRhYmxlTmFtZTonZmlsZVRhYmxlJyxcbiAgICAgICAgICAgIHN0cmVhbTpkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfSU1BR0VcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgICAgICAvL0xhbWJiZGEgZnVuY3Rpb25cbiAgICAgICAgY29uc3QgZHluYW1vRGJTdHJlYW1MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsJ0R5bmFtb0RiU3RyZWFtTGFtYmRhJyx7XG4gICAgICAgICAgIHJ1bnRpbWU6bGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICAgICAgIGhhbmRsZXI6J2RkYlN0cmVhbWhhbmRsaW5nLmhhbmRsZXInLFxuICAgICAgICAgICBjb2RlOmxhbWJkYS5Db2RlLmZyb21Bc3NldCgnL1VzZXJzL3JhZ2hhdmdhbmRvdHJhL0RvY3VtZW50cy9hd3MtY2RrLWR5bmFtb2RiL2xhbWJkYS8nKSxcbiAgICAgICAgICAgZW52aXJvbm1lbnQ6e1xuICAgICAgICAgICAgICAgVEFCTEVfTkFNRTpmaWxlVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGR5bmFtb0RiU3RyZWFtTGFtYmRhLmFkZEV2ZW50U291cmNlKG5ldyBhd3NfbGFtYmRhX2V2ZW50X3NvdXJjZXMuRHluYW1vRXZlbnRTb3VyY2UoZmlsZVRhYmxlLHtcbiAgICAgICAgICAgIHN0YXJ0aW5nUG9zaXRpb246IGxhbWJkYS5TdGFydGluZ1Bvc2l0aW9uLlRSSU1fSE9SSVpPTixcbiAgICAgICAgICAgIGJhdGNoU2l6ZTogNSxcbiAgICAgICAgICAgIGJpc2VjdEJhdGNoT25FcnJvcjogdHJ1ZSxcbiAgICAgICAgICAgIHJldHJ5QXR0ZW1wdHM6IDIsXG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgZmlsZVRhYmxlLmdyYW50U3RyZWFtUmVhZChkeW5hbW9EYlN0cmVhbUxhbWJkYSlcbiAgICB9XG59XG4iXX0=