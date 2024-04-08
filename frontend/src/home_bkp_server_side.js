import React,{useState} from 'react';
import { useNavigate } from "react-router-dom";
import AWS from 'aws-sdk';

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

        if(!selectedFile)
        {
            console.error('No File Selected');
            return;
        }
        try {
            // Request a pre-signed URL from your backend
            // const response = await fetch('http://localhost:3000/generate-presigned-url');
            console.log('1111');
            const response = await fetch(`http://localhost:3000/generate-presigned-url?filename=${encodeURIComponent(selectedFile.name)}`);
            // console.log('2222');
            console.log(`Response:${response}`);
            const data = await response.json();
            const presignedUrl = data.url;

            // Upload the file to S3 using the pre-signed URL
            const result = await fetch(presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream' // change as needed
                },
                body: selectedFile
            });

            if (result.ok) {
                console.log('File was successfully uploaded!');
            } else {
                console.error('Failed to upload file');
            }
        } catch (error) {
            console.error('An error occurred while uploading the file:', error);
        }
        setInputKey(Date.now());
        setSelectedFile(null); // Clear the selected file state
        setInputText(''); // Clear the text input state
        // Navigate to a different route if required
        // navigate('/some-route');
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
