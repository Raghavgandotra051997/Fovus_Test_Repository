import React,{useState} from 'react';
import { useNavigate } from "react-router-dom";
import {uploadData} from 'aws-amplify/storage';
//import { Button } from 'flowbite-react';
import awsExports from "./aws-exports";

function Home({ inputText, setInputText, selectedFile, setSelectedFile }) {
    const navigate = useNavigate();

    const [inputKey, setInputKey] = useState(Date.now());
    const handleTextInputChange = (event) => {
        setInputText(event.target.value);
    };

    const handleFileInputChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        // Process the data here, e.g., send to an API or log to the console
        console.log(`Text Input: ${inputText}`);

        if(selectedFile) {
            try {
                const fileName = selectedFile.name;
                const bucketName = awsExports.aws_user_files_s3_bucket;
                const inputFilePath = `${bucketName}/public/${fileName}`;

                //upload to S3
                await uploadData({
                    key:fileName,
                    data:selectedFile,
                    contentType:selectedFile.type
                });
                console.log(`${fileName} uploaded successfully`);

                //Making a call to backend API Gateway sending the input text and inputfilepath(which is path of the file stored on S3) using POST Method
                const response = await fetch('https://mvr8flo9w3.execute-api.us-east-2.amazonaws.com/prod/data',{
                    method:'POST',
                    headers:{
                        'Content-Type':'application/json',
                    },
                    body:JSON.stringify({
                        text: inputText,
                        input_file_path: inputFilePath,
                    }),
                });

                if(!response.ok){
                    const errorBody = await response.json();
                    throw new Error(errorBody.message || "Unknown API Errors");
                }
                else
                    console.log('Successful API Response');

                // Once the Processing is done render the states back to initial state
                setSelectedFile(null);
                setInputText('');
            }
            catch (error) {
                console.error('Error uploading file:', error);
            }
        }

    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label htmlFor="textInput">Text input:</label>
                <input
                    type="text"
                    value={inputText}
                    onChange={handleTextInputChange}
                    id="textInput"
                />
            </div>
            <div>
                <label htmlFor="fileInput">File input:</label>
                <input
                    type="file"
                    onChange={handleFileInputChange}
                    id="fileInput"
                    accept=".txt"
                />
            </div>
            <button type="submit">Submit</button>
        </form>
    );
}

export default Home;
