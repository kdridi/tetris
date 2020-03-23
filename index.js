const fs = require('fs')
const path = require('path')
const API = require('./data/api')

const main = async (api) => {
	const requests = await api.getRepositoryList()

	const startTime = new Date()

	const responses = []
	for (let requestIndex = 0; requestIndex < requests.length; requestIndex++) {
		const request = requests[requestIndex]
		console.log(`>>>> request[${requestIndex + 1}/${requests.length}]`)

		const { wdir, deliveryURL, testsURL, artifacts } = request

		const prepareTestsDirectory = { clone: null, make: null }
		console.log(`>>>> request[${requestIndex + 1}/${requests.length}]: `, 'prepareTestsDirectory')
		prepareTestsDirectory.clone = await api.gitClone(wdir, testsURL, 'tests')
		prepareTestsDirectory.make = await api.dockerRun(wdir, 'make', '-C', 'tests')

		const prepareDeliveryDirectory = { clone: null, make: null }
		console.log(`>>>> request[${requestIndex + 1}/${requests.length}]: `, 'prepareDeliveryDirectory')
		prepareDeliveryDirectory.clone = await api.gitClone(wdir, deliveryURL, 'delivery')
		prepareDeliveryDirectory.make = await api.dockerRun(wdir, 'make', '-C', 'delivery')

		const countLinesOfCode = await api.cloc(wdir, 'delivery')
		console.log(`>>>> request[${requestIndex + 1}/${requests.length}]: `, 'countLinesOfCode')

		const deployArtifacts = {}
		for (let artifactIndex = 0; artifactIndex < artifacts.length; artifactIndex++) {
			const artifact = artifacts[artifactIndex]
			console.log(`>>>> request[${requestIndex + 1}/${requests.length}]: `, `deployArtifacts[${artifactIndex + 1}/${artifacts.length}]`)

			const dirname = artifact.split('/')
			const basename = dirname.pop()

			const tpath = ['tests', ...dirname].join('/')
			const fpath = ['delivery', ...dirname, basename].join('/')

			const data = { mkdir: null, copy: null }
			data.mkdir = await api.dockerRun(wdir, 'mkdir', '-p', tpath)
			data.copy = await api.dockerRun(wdir, 'cp', fpath, tpath)

			deployArtifacts[artifact] = data
		}

		const tests = Array.prototype.concat
			.apply(
				[],
				Object.entries(JSON.parse(fs.readFileSync(path.resolve(wdir, 'tests', 'manifest.json'))).skills).map(([category, { output }]) => {
					return output.map((skill) => Object.assign(skill, { category }))
				})
			)
			.map((skill) => Object.assign({ timeout: '30s' }, skill))
			.map((skill) => Object.assign(skill, { timeout: parseInt(skill.timeout.split('s').shift()) }))

		const runTests = []
		console.log(`>>>> request[${requestIndex + 1}/${requests.length}]: `, 'runTests')
		for (let testIndex = 0; testIndex < tests.length; testIndex++) {
			const test = tests[testIndex]
			console.log(`>>>> test[${testIndex + 1}/${tests.length}] : `)

			const { timeout, cmd } = test
			const result = await api.dockerRun(path.resolve(wdir, 'tests'), 'timeout', timeout, 'bash', '-c', cmd)

			runTests.push({ test, result })
		}

		const gitLogs = await api.gitLogs(path.resolve(wdir, 'delivery'))
		console.log(`>>>> request[${requestIndex + 1}/${requests.length}]: `, 'gitLogs')

		responses.push(
			Object.assign(request, {
				steps: {
					countLinesOfCode,
					gitLogs,
					prepareTestsDirectory,
					prepareDeliveryDirectory,
					deployArtifacts,
					runTests,
				},
			})
		)
	}

	const stopTime = new Date()

	const result = { startTime, stopTime, results: responses }

	await api.mail(result)

	return JSON.stringify('SUCCESS', null, 2)
}

main(new API('dante')).then(
	(res) => console.log(res),
	(err) => console.error(err)
)
