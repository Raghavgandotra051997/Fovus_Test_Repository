import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
function FileSubmitForm() {
    const [inputText, setInputText] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const navigate = useNavigate();
    const handleTextInputChange = (event) => {
        setInputText(event.target.value);
    };

    const handleFileInputChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        // Process the data here, e.g., send to an API or log to the console
        console.log(`Text Input: ${inputText}`);
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function(e) {
                console.log(`File content: ${e.target.result}`);
            };
            reader.readAsText(selectedFile);
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

export default FileSubmitForm;

