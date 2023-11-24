'use strict';

const vscode = require('vscode');
const child_process = require('child_process')
const fs = require("fs");
const { homedir } = require('os');

console.log("setting up the parallel-lang VS Code Extension");

vscode.languages.registerHoverProvider('parallel', {
	async provideHover(document, position, token) {
		// get the document text (it may not have been saved to the file system yet)
		const text = document.getText();
		
		// get the hover location
		const line = position.e;
		const character = position.c;
		console.log("character", character, "line", line);
		
		// get the compilerPath
		const compilerPathConfiguration = vscode.workspace.getConfiguration().get('conf.parallel.compilerPath')
		let compilerPath = "";
		if (compilerPathConfiguration.length > 0) {
			compilerPath = `${vscode.workspace.workspaceFolders[0].uri.path}${compilerPathConfiguration}`;
		} else {
			compilerPath = `${homedir}/.Parallel_Lang/Parallel-lang`;
		}
		
		// get the modulePath
		const modulePath = document.uri.path.split("/");
		modulePath.pop();
		console.log(text.length, "\n", modulePath.join("/"), document.uri.path);
		
		return new Promise((resolve, reject) => {
			try {
				const args = ["query", modulePath.join("/"), document.uri.path, text.length, line, character];
				console.log(compilerPath, args);
				const childProcess = child_process.spawn(compilerPath, args);
				
				childProcess.stdin.write(text);
				
				childProcess.on('error', (error) => {
					console.log(`error: ${error}`);
				});
				
				childProcess.stdout.on('data', (data) => {
					console.log(`stdout: ${data}`);
					resolve({
						contents: [`${data}`]
					});
				});
				
				childProcess.stderr.on('data', (data) => {
					console.error(`stderr: ${data}`);
				});
				
				childProcess.on('close', (code) => {
					console.log(`process exited with code ${code}`);
					if (code != 0) {
						resolve({
							contents: ["childProcess error"]
						});
					}
				});
			} catch (error) {
				console.log(error);
			}
		})
	}
});