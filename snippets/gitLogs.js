const execa = require('execa')

const gitLogs = async (dir) => {
	try {
		const data = await execa('bash', ['-c', 'git log --pretty=format:\'{%n  "commit": "%H",%n  "abbreviated_commit": "%h",%n  "tree": "%T",%n  "abbreviated_tree": "%t",%n  "parent": "%P",%n  "abbreviated_parent": "%p",%n  "refs": "%D",%n  "encoding": "%e",%n  "subject": "%s",%n  "sanitized_subject_line": "%f",%n  "body": "%b",%n  "commit_notes": "%N",%n  "verification_flag": "%G?",%n  "signer": "%GS",%n  "signer_key": "%GK",%n  "author": {%n    "name": "%aN",%n    "email": "%aE",%n    "date": "%aD"%n  },%n  "commiter": {%n    "name": "%cN",%n    "email": "%cE",%n    "date": "%cD"%n  }%n},\''], { cwd: dir })
		const arr = data.stdout.split(',')
		arr.pop()
		const json = `[${arr.join(',')}]`
		return JSON.parse(json)
	} catch (error) {
		return []
	}
}

const main = async () => {
	const result = await gitLogs('/tmp')
	return JSON.stringify(result, null, 2)
}

main().then(
	(res) => console.log(res),
	(err) => console.error(err)
)
