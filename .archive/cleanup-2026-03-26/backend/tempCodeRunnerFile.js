
const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());

// Enable CORS for all origins (simple for hackathon/demo)
app.use(cors());
