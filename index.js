require('dotenv').config()
var express = require('express')
var request = require('request')
var request = require('request')
var bodyParser = require('body-parser')

var app = express()
var urlencodedParser = bodyParser.urlencoded({
	extended: false,
})

// Lets start our server
app.listen(process.env.PORT || 3001, function() {
	//Callback triggered when server is successfully listening. Hurray!
	console.log('Slack Vote Started on:' + process.env.PORT)
})

app.get('/auth', (req, res) => {
	res.sendFile(__dirname + '/add-to-slack.html')
})

app.get('/auth/redirect', (req, res) => {
	var options = {
		url: 'https://slack.com/api/oauth.access', //URL to hit
		qs: {
			code: req.query.code,
			client_id: process.env.CLIENT_ID,
			client_secret: process.env.CLIENT_SECRET,
			// redirect_uri: process.env.REDIRECT_URI
		}, //Query string data
		method: 'GET', //Specify the method
	}
	request(options, (error, response, body) => {
		var JSONresponse = JSON.parse(body)
		if (!JSONresponse.ok) {
			res.send('Error encountered: \n' + JSON.stringify(JSONresponse)).status(200).end()
		} else {
			res.send('Success!')
		}
	})
})

app.post('/commands/vote', urlencodedParser, (req, res) => {
	res.status(200).end()
	var reqBody = req.body
	var responseURL = reqBody.response_url

	let { text, actions, question } = parseSlashCommand(reqBody.text)
	var message = {
		response_type: 'in_channel',
		text: `*${question}*`,
		attachments: [
			{
				text: text,
				fallback: "Shame... buttons aren't supported in this land",
				callback_id: 'slack-vote',
				color: '#084477',
				attachment_type: 'default',
				actions: actions,
			},
		],
	}
	sendMessageToSlackResponseURL(responseURL, message)
})

app.post('/actions', urlencodedParser, function(req, res) {
	res.status(200).end()
	var actionJSONPayload = JSON.parse(req.body.payload)
	let text = updateTextWithVote(
		actionJSONPayload.original_message.attachments[0].text,
		actionJSONPayload.actions[0].value,
		actionJSONPayload.user.id
	)
	var message = {
		response_type: 'in_channel',
		text: actionJSONPayload.original_message.text,
		replace_original: true,
		attachments: [
			{
				text: text,
				fallback: "Shame... buttons aren't supported in this land",
				callback_id: 'slack-vote',
				color: '#084477',
				attachment_type: 'default',
				actions: actionJSONPayload.original_message.attachments[0].actions,
			},
		],
	}
	sendMessageToSlackResponseURL(actionJSONPayload.response_url, message)
})

function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
	var postOptions = {
		uri: responseURL,
		method: 'POST',
		headers: {
			'Content-type': 'application/json',
		},
		json: JSONmessage,
	}
	request(postOptions, (error, response, body) => {
		if (error) {
			console.log(error)
		}
	})
}

function parseSlashCommand(text) {
	return text.split(',').reduce((acc, option, index) => {
		if (index === 0) {
			return {
				...acc,
				question: option,
			}
		}
		let optionNoWhiteSpace = option.trim()
		let matchEmoji = optionNoWhiteSpace.match(/^:[^:\s]*(?:::[^:\s]*)*:/)
		let emoji = matchEmoji ? matchEmoji[0] : numberToEmoji(index)
		let text = `${acc.text}\n\n${matchEmoji ? '' : `${numberToEmoji(index)} `}${optionNoWhiteSpace}`
		return {
			...acc,
			text,
			actions: [
				...acc.actions,
				{
					name: emoji,
					text: emoji,
					type: 'button',
					value: index,
				},
			],
		}
	}, {
		question: '',
		text: '',
		actions: [],
	})
}

function numberToEmoji(number) {
	return (
		{
			1: ':one:',
			2: ':two:',
			3: ':three:',
			4: ':four:',
			5: ':five:',
			6: ':six:',
			7: ':seven:',
			8: ':eight:',
			9: ':nine:',
			10: ':ten:',
		}[number] || ':x:'
	)
}

function splitBuiltText(text) {
	return text.split('\n\n')
}

function updateTextWithVote(text, vote, user) {
	let options = splitBuiltText(text)
	let optionToUpdate = options[vote]
	let hasUsers = optionToUpdate.lastIndexOf('\n') > 0
	let optionText = hasUsers ? optionToUpdate.slice(0, optionToUpdate.lastIndexOf('\n')) : optionToUpdate
	let userText = hasUsers ? optionToUpdate.slice(optionToUpdate.lastIndexOf('\n')) : ''
	let usersWhoVotedForOption = userText.match(/(<@(\w|\d)+>)/g) || []
	console.log(usersWhoVotedForOption)
	let formattedUsername = stringifyUserId(user)
	let userIndex = usersWhoVotedForOption.indexOf(formattedUsername)
	if (userIndex >= 0) {
		usersWhoVotedForOption.splice(userIndex, 1)
	} else {
		usersWhoVotedForOption.push(formattedUsername)
	}
	console.log(usersWhoVotedForOption)
	// console.log(optionToUpdate, hasUsers, optionText, userText, formattedUsername, usersWhoVotedForOption)
	let updatedOption =
		usersWhoVotedForOption.length > 0
			? `${optionText}\n${buildPublicUserVotes(usersWhoVotedForOption)}`
			: optionText

	options[vote] = updatedOption
	let newText = options.join('\n\n')
	return newText
}

function buildPublicUserVotes(users) {
	return `  \`${users.length}\`     ${users.map((user, index) => `${users}${index === user.length - 1 ? ', ' : ''}`)}`
}

function stringifyUserId(id) {
	return `<@${id}>`
}
