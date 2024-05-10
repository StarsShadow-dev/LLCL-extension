import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from "child_process";

function panic(): never {
	throw "panic";
}

function getCompilerPath(): string {
	let compilerPath: string;
	
	const compilerPathConfiguration = vscode.workspace.getConfiguration().get('conf.ucl_vscode.compilerPath') as string;
	if (compilerPathConfiguration.length > 0) {
		if (compilerPathConfiguration[0] == "~") {
			panic();
			// let newCompilerPath = compilerPathConfiguration.split("");
			// newCompilerPath.shift();
			// compilerPath = `${homedir}${newCompilerPath.join("")}`;
		} else {
			if (!vscode.workspace.workspaceFolders) {
				panic();
			}
			compilerPath = path.join(vscode.workspace.workspaceFolders[0].uri.path, compilerPathConfiguration);
		}
	} else {
		panic();
	}
	
	return compilerPath;
}

function runCompiler(compilerArgs: string[], stdin: string, onStdout: (stdout: string | null) => void) {
	const compilerPath = getCompilerPath();
	const args = [compilerPath, ...compilerArgs];
	console.log(compilerPath, args);
	const childProcess = child_process.spawn("node", args);
	
	let gotStdout = false;
	
	childProcess.stdin.write(stdin);
	
	childProcess.on('error', (error) => {
		console.log(`compiler error: ${error}`);
	});
	
	childProcess.stdout.on('data', (stdout) => {
		console.log(`compiler stdout ${stdout}`);
		
		gotStdout = true;
		
		onStdout(`${stdout}`);
	});
	
	childProcess.on('close', (code) => {
		console.log(`compiler exited with code: ${code}`);
		if (!gotStdout) {
			onStdout(null);
		}
	});
}

export function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('test');
	
	if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId == "ucl") {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection);
	}
	
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor && editor.document.languageId == "ucl") {
			updateDiagnostics(editor.document, collection);
		}
	}));
	
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
		if (document.languageId == "ucl") {
			updateDiagnostics(document, collection);
		}
	}));
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	runCompiler([`${document.fileName}`, "-ide", "compileFile"], "", (stdout: string | null) => {
		if (stdout) {
			if (stdout.length == 0) return;
			const error = JSON.parse(stdout);
			
			let relatedInformation: vscode.DiagnosticRelatedInformation[] = [];
			
			for (let i = 0; i < error.indicators.length; i++) {
				const location = error.indicators[i].location;
				relatedInformation.push(
					new vscode.DiagnosticRelatedInformation(
						new vscode.Location(vscode.Uri.parse(location.path),
							new vscode.Range(
								new vscode.Position(location.line-1, location.startColumn-1),
								new vscode.Position(location.line-1, location.endColumn),
							)
						),
						error.indicators[i].msg,
					)
				)
			}
			
			const mainLocation = error.indicators[0].location;
			
			collection.set(vscode.Uri.parse(mainLocation.path), [{
				code: '',
				message: error.msg,
				range: new vscode.Range(
					new vscode.Position(mainLocation.line-1, mainLocation.startColumn-1),
					new vscode.Position(mainLocation.line-1, mainLocation.endColumn),
				),
				severity: vscode.DiagnosticSeverity.Error,
				source: '',
				relatedInformation: relatedInformation,
			}]);
		} else {
			collection.clear();
		}
	});
}