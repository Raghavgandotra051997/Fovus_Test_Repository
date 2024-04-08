import React,{useState} from 'react';
import { useNavigate } from "react-router-dom";
import {uploadData} from 'aws-amplify/storage';
import awsExports from "./aws-exports";

function Home({ inputText, setInputText, selectedFile, setSelectedFile }) {

    const [textInputError, setTextInputError] = useState('');
    const [fileInputError, setFileInputError] = useState('');

    useNavigate();
    const handleTextInputChange = (event) => {
        setInputText(event.target.value);
    };

    const handleFileInputChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setTextInputError('');
        setFileInputError('');

        // Validate text input
        if (!inputText.trim()) {
            setTextInputError('Text input cannot be empty.');
            return; // Prevent further execution
        }

        // Validate file input
        if (!selectedFile) {
            setFileInputError('Please select a file to upload.');
            return; // Prevent further execution
        }


        console.log(`Text Input: ${inputText}`);
        // Process the data here
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
        <div className="container mx-auto p-4">
            <h1 className="text-2xl md:text-4xl font-bold text-center mb-4">FOVUS CODING ASSIGNMENT</h1>
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
                <div className="mb-4">
                    <label htmlFor="textInput" className="block mb-2 text-sm font-medium">Text input:</label>
                    <input
                        type="text"
                        value={inputText}
                        onChange={handleTextInputChange}
                        id="textInput"
                        className={`bg-gray-50 border ${textInputError ? 'border-red-500' : 'border-gray-300'} text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                    />
                    {textInputError && <p className="text-red-500 text-xs mt-1">{textInputError}</p>}
                </div>
                <div className="mb-4">
                    <label htmlFor="fileInput" className="block mb-2 text-sm font-medium">File input:</label>
                    <input
                        type="file"
                        onChange={handleFileInputChange}
                        id="fileInput"
                        accept=".txt"
                        className={`block w-full text-sm text-gray-900 bg-gray-50 rounded-lg ${fileInputError ? 'border-red-500' : 'border-gray-300'} cursor-pointer`}
                    />
                    {fileInputError && <p className="text-red-500 text-xs mt-1">{fileInputError}</p>}
                </div>
                <button type="submit"
                        className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center">Submit
                </button>
            </form>
        </div>
    );
}

export default Home;
