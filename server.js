import dotenv from "dotenv";
dotenv.config();

import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const PORT = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

var corsOptions = {
	origin: [process.env.FRONT_URI, process.env.REXP],
	credentials: true,
};

app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", req.headers.origin);
	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept"
	);
	next();
});

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//frontend
// Get the current module's URL and convert it to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'client/build')));

app.get("*", (req, res) => {
	return res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

import allRoutes from "./routes.js";
app.use("/api", allRoutes);

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
