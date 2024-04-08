import { BrowserRouter, Routes, Route,HashRouter } from 'react-router-dom';
import './App.css';
import Home from "./home";
import { useState } from "react";

import {Amplify} from 'aws-amplify';
import awsExports from './aws-exports';
Amplify.configure(awsExports);

function App() {
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  //Whenever the application opens up it navigates to the Home page
  return (
      <div className="App">
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home inputText={inputText} setInputText={setInputText} selectedFile={selectedFile} setSelectedFile={setSelectedFile} />} />
          </Routes>
        </HashRouter>
      </div>
  );
}

export default App;
