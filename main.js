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
				const args = ["query", "hover", modulePath.join("/"), document.uri.path, text.length, line, character];
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
				
				childProcess.on('close', (code) => {
					console.log(`process exited with code ${code}`);
					if (code != 0) {
						resolve({
							contents: ["childProcess error"]
						});
					} else {
						resolve(undefined);
					}
				});
			} catch (error) {
				console.log(error);
			}
		})
	}
});

function getNewCompletion(completionItemKind, label, documentationString) {
	const newCompletion = new vscode.CompletionItem(label, completionItemKind);
	newCompletion.documentation = new vscode.MarkdownString(documentationString);
	return newCompletion;
}

vscode.languages.registerCompletionItemProvider('parallel', {
	async provideCompletionItems(document, position, token, context) {
		console.log("position", position);
		
		const text = document.getText();
		
		const line = position.c + 1;
		const character = position.e;
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
				const args = ["query", "suggestions", modulePath.join("/"), document.uri.path, text.length, line, character];
				console.log(compilerPath, args);
				const childProcess = child_process.spawn(compilerPath, args);
				
				childProcess.stdin.write(text);
				
				childProcess.on('error', (error) => {
					console.log(`error: ${error}`);
				});
				
				childProcess.stdout.on('data', (data) => {
					try {
						let completionItems = [];
						
						console.log("data", `${data}`);
						
						const array = JSON.parse(`${data}`);
						
						for (let i = 0; i < array.length; i++) {
							const e = array[i];
							completionItems.push(getNewCompletion(e[0], e[1], e[2]))
						}
						
						console.log("completionItems", completionItems);
						resolve(completionItems);
					} catch (error) {
						resolve({
							contents: ["childProcess stdout error"]
						});
						console.log(error);
					}
				});
				
				childProcess.on('close', (code) => {
					console.log(`process exited with code ${code}`);
					if (code != 0) {
						resolve({
							contents: ["childProcess error"]
						});
					} else {
						resolve(undefined);
					}
				});
			} catch (error) {
				console.log(error);
			}
		})
	}
});