// Import the AWS SDK for JavaScript.
const AWS = require('aws-sdk');
// Create a DynamoDB DocumentClient, which offers a simpler interface for DynamoDB operations.
const dynamoDB = new AWS.DynamoDB.DocumentClient();

//Retrieve DynamoDB Table Name environment variable
const tableName = process.env.TABLE_NAME;

//The handler function which 'updateDdbLambda' calls when it is executed
exports.handler = async (event)=>{
    try{
        //Parsing the JSON body from the event object provided by API Gateway
        const body = JSON.parse(event.body);
        console.log("Received event body:", body);
        const { nanoid } = await import('nanoid');

        // Constructing the parameters for the DynamoDB put operation.
        // This includes the table name, and an item to insert, which consists of a unique ID,
        // the text content, the file path, and a timestamp of when the item was created.
        const params ={
            TableName: tableName,
            Item:{
                id: nanoid(),
                text: body.text,
                filePath:body.input_file_path,
                createdAt:new Date().toISOString(),
            },
        };
        console.log("DynamoDB put parameters:", params);

        // Execute the put operation to insert the item into DynamoDB.
        await dynamoDB.put(params).promise();

        // If the operation succeeds, return a 200 status code and a success message.
        return {
            statusCode:200,
            headers:{
                "Content-Type":"application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                "Access-Control-Allow-Headers":"Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
            },
            body:JSON.stringify({message:'Data saved successfully'}),
        };
    }catch (error){
        console.error('Error saving data to DynamoDB',error);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: 'Failed to save data' }),
        };
    }
};


