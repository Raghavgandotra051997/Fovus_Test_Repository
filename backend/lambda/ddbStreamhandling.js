const AWS = require('aws-sdk');
// Initialize the EC2 service interface object to interact with Amazon EC2.
const ec2 = new AWS.EC2();
// Initialize the DynamoDB DocumentClient to interact with DynamoDB in a more flexible way than the standard client.
const dynamoDB = new AWS.DynamoDB.DocumentClient();

//Retrieve DynamoDB Table Name environment variable
const tableName = process.env.TABLE_NAME;

//Lambda handler function invoked when dynamoDbStreamLambda is executed
exports.handler = async (event)=>{

    console.log("Event: ",JSON.stringify(event,null,2));
    let recordProcessed = 0;
    for(const record of event.Records){
        // Check if the event is an INSERT event, indicating new data added to the source DynamoDB table.
        if(record.eventName==="INSERT"){
            // Unmarshall the DynamoDB data to a regular JavaScript object.
             const newItem = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
            // Extract the bucket name and file name from the filePath attribute of the new item.
             const parts = newItem.filePath.split('/');
             const bucketName = parts[0];
             const fileName = parts[parts.length-1];
             const inputText = newItem.text;

            // Generate the output file name by prefixing the input file name.
             const outPutFileName = "Output-"+fileName;

            // Skip processing and exit the function if the input text indicates end of file (eof).
             if(inputText === "eof")
             {
                 console.log('No update required');
                 return;
             }

            // Script to be executed by the EC2 instance, which includes updating packages,
            // installing the AWS CLI, downloading a script from S3, executing it, and then self-terminating the instance.
            const userDataScript = `#!/bin/bash
            yum update -y
            yum install -y aws-cli
            aws s3 cp s3://${bucketName}/script.sh .
            chmod +x script.sh
            ./script.sh ${bucketName} ${fileName} "${inputText}"
            # Self-terminate the instance
            TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
            INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
            aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region ${process.env.AWS_REGION}
            # Add any other commands you need to run below
            `;

            // Encode the user data script to base64 format as expected by the EC2 runInstances method.
            const userDataEncoded = Buffer.from(userDataScript).toString('base64');

            // Parameters for launching a new EC2 instance, including the AMI ID, instance type, and user data script.
            const params = {
                ImageId: 'ami-0900fe555666598a2',
                InstanceType: 't2.micro',
                MinCount: 1,
                MaxCount: 1,
                UserData: userDataEncoded,
                IamInstanceProfile: {
                    Name: "EC2S3AccessRole" // IAM Role as passed by lambda used to Access S3 buckets
                },
            };

            try {
                const launchInstance = await ec2.runInstances(params).promise();
                console.log("EC2 Instance launched: ", launchInstance);
            } catch (error) {
                console.error("Error launching EC2 Instance: ", error);
                throw error;
            }

            // Parameters for inserting a new item into the DynamoDB table to indicate processing completion.
            const dbparams={
                TableName:tableName,
                Item:{
                    id:"1",
                    text : "eof",
                    filePath: bucketName +"/public/"+ outPutFileName,
                    createdAt:new Date().toISOString(),
                }
            }
            console.log("DynamoDB put parameters:", dbparams);
            await dynamoDB.put(dbparams).promise()
            recordProcessed++;
        }
    }
    console.log(`${recordProcessed} record(s) processed.`);
};



