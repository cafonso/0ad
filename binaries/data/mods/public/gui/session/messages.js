/**
 * All known cheat commands.
 * @type {Object}
 */
const g_Cheats = getCheatsData();

/**
 * Number of seconds after which chatmessages will disappear.
 */
const g_ChatTimeout = 30;

/**
 * Maximum number of lines to display simultaneously.
 */
const g_ChatLines = 20;

/**
 * The strings to be displayed including sender and formating.
 */
var g_ChatMessages = [];

/**
 * Holds the timer-IDs used for hiding the chat after g_ChatTimeout seconds.
 */
var g_ChatTimers = [];

/**
 * Handle all netmessage types that can occur.
 */
var g_NetMessageTypes = {
	"netstatus": msg => handleNetStatusMessage(msg),
	"players": msg => handlePlayerAssignmentsMessage(msg),
	"rejoined": msg => addChatMessage({ "type": "rejoined", "guid": msg.guid }),
	"kicked": msg => addChatMessage({ "type": "system", "text": sprintf(translate("%(username)s has been kicked"), { "username": msg.username }) }),
	"banned": msg => addChatMessage({ "type": "system", "text": sprintf(translate("%(username)s has been banned"), { "username": msg.username }) }),
	"chat": msg => addChatMessage({ "type": "message", "guid": msg.guid, "text": msg.text }),
	"aichat": msg => addChatMessage({ "type": "message", "guid": msg.guid, "text": msg.text, "translate": true }),
	"gamesetup": msg => "", // Needed for autostart
	"start": msg => ""
};

var g_FormatChatMessage = {
	"system": msg => msg.text,
	"connect": msg => sprintf(translate("%(player)s is starting to rejoin the game."), { "player": colorizePlayernameByGUID(msg.guid) }),
	"disconnect": msg => sprintf(translate("%(player)s has left the game."), { "player": colorizePlayernameByGUID(msg.guid) }),
	"rejoined": msg => sprintf(translate("%(player)s has rejoined the game."), { "player": colorizePlayernameByGUID(msg.guid) }),
	"clientlist": msg => getUsernameList(),
	"message": msg => formatChatCommand(msg),
	"defeat": msg => formatDefeatMessage(msg),
	"diplomacy": msg => formatDiplomacyMessage(msg),
	"tribute": msg => formatTributeMessage(msg),
	"attack": msg => formatAttackMessage(msg)
};

/**
 * Show a label and grey overlay or hide both on connection change.
 */
var g_StatusMessageTypes = {
	"authenticated": msg => translate("Connection to the server has been authenticated."),
	"connected": msg => translate("Connected to the server."),
	"disconnected": msg => translate("Connection to the server has been lost.") + "\n" +
	                // Translation: States the reason why the client disconnected from the server.
	                sprintf(translate("Reason: %(reason)s."), { "reason": getDisconnectReason(msg.reason) }) + "\n" +
	                translate("The game has ended."),
	"waiting_for_players": msg => translate("Waiting for other players to connect..."),
	"join_syncing": msg => translate("Synchronising gameplay with other players..."),
	"active": msg => ""
};

/**
 * Chatmessage shown after commands like /me or /enemies.
 */
var g_ChatCommands = {
	"regular": {
		"context": translate("(%(context)s) %(userTag)s %(message)s"),
		"no-context": translate("%(userTag)s %(message)s")
	},
	"me": {
		"context": translate("(%(context)s) * %(user)s %(message)s"),
		"no-context": translate("* %(user)s %(message)s")
	}
};

var g_ChatAddresseeContext = {
	"/team": translate("Team"),
	"/allies": translate("Ally"),
	"/enemies": translate("Enemy"),
	"/msg": translate("Private")
};

/**
 * Returns true if the current player is an addressee, given the chat message type and sender.
 */
var g_IsChatAddressee = {
	"/team": senderID =>
		g_Players[senderID] &&
		g_Players[Engine.GetPlayerID()] &&
		g_Players[Engine.GetPlayerID()].team != -1 &&
		g_Players[Engine.GetPlayerID()].team == g_Players[senderID].team,

	"/allies": senderID =>
		g_Players[senderID] &&
		g_Players[senderID].isMutualAlly[Engine.GetPlayerID()],

	"/enemies": senderID =>
		g_Players[senderID] &&
		g_Players[senderID].isEnemy[Engine.GetPlayerID()],

	"/msg": (senderID, addresseeGUID) =>
		g_Players[Engine.GetPlayerID()] &&
		g_PlayerAssignments[addresseeGUID] &&
		g_PlayerAssignments[addresseeGUID].name == g_Players[Engine.GetPlayerID()].name
};

/**
 * Chatmessage shown on diplomacy change.
 */
var g_DiplomacyMessages = {
	"active": {
		"ally": translate("You are now allied with %(player)s."),
		"enemy": translate("You are now at war with %(player)s."),
		"neutral": translate("You are now neutral with %(player)s.")
	},
	"passive": {
		"ally": translate("%(player)s is now allied with you."),
		"enemy": translate("%(player)s is now at war with you."),
		"neutral": translate("%(player)s is now neutral with you.")
	},
	"observer": {
		"ally": translate("%(player)s is now allied with %(player2)s."),
		"enemy": translate("%(player)s is now at war with %(player2)s."),
		"neutral": translate("%(player)s is now neutral with %(player2)s.")
	}
};

/**
 * Defines how the GUI reacts to notifications that are sent by the simulation.
 */
var g_NotificationsTypes =
{
	"chat": function(notification, player)
	{
		let message = {
			"type": "message",
			"guid": findGuidForPlayerID(player) || -1,
			"text": notification.message
		};

		if (message.guid == -1)
			message.player = player;

		addChatMessage(message);
	},
	"aichat": function(notification, player)
	{
		let message = {
			"guid": findGuidForPlayerID(player) || -1,
			"type": "message",
			"text": notification.message,
			"translate": true
		};

		if (message.guid == -1)
			message.player = player;

		if (notification.translateParameters)
		{
			message.translateParameters = notification.translateParameters;
			message.parameters = notification.parameters;
			// special case for formatting of player names which are transmitted as _player_num
			for (let param in message.parameters)
			{
				if (!param.startsWith("_player_"))
					continue;

				message.parameters[param] = colorizePlayernameByID(message.parameters[param]);
			}
		}

		addChatMessage(message);
	},
	"defeat": function(notification, player)
	{
		addChatMessage({
			"type": "defeat",
			"guid": findGuidForPlayerID(player),
			"player": player
		});

		updateDiplomacy();
	},
	"diplomacy": function(notification, player)
	{
		addChatMessage({
			"type": "diplomacy",
			"sourcePlayer": player,
			"targetPlayer": notification.targetPlayer,
			"status": notification.status
		});

		updateDiplomacy();
	},
	"quit": function(notification, player)
	{
		Engine.Exit();
	},
	"tribute": function(notification, player)
	{
		addChatMessage({
			"type": "tribute",
			"sourcePlayer": notification.donator,
			"targetPlayer": player,
			"amounts": notification.amounts
		});
	},
	"attack": function(notification, player)
	{
		if (player != Engine.GetPlayerID())
			return;
		if (Engine.ConfigDB_GetValue("user", "gui.session.attacknotificationmessage") !== "true")
			return;
		addChatMessage({
			"type": "attack",
			"player": player,
			"attacker": notification.attacker,
			"targetIsDomesticAnimal": notification.targetIsDomesticAnimal
		});
	},
	"dialog": function(notification, player)
	{
		if (player == Engine.GetPlayerID())
			openDialog(notification.dialogName, notification.data, player);
	},
	"resetselectionpannel": function(notification, player)
	{
		if (player != Engine.GetPlayerID())
			return;
		g_Selection.rebuildSelection({});
	}
};

/**
 * Loads all known cheat commands.
 *
 * @returns {Object}
 */
function getCheatsData()
{
	let cheats = {};
	for (let fileName of getJSONFileList("simulation/data/cheats/"))
	{
		let currentCheat = Engine.ReadJSONFile("simulation/data/cheats/"+fileName+".json");
		if (!currentCheat)
			continue;
		if (Object.keys(cheats).indexOf(currentCheat.Name) !== -1)
			warn("Cheat name '" + currentCheat.Name + "' is already present");
		else
			cheats[currentCheat.Name] = currentCheat.Data;
	}
	return cheats;
}

/**
 * Reads userinput from the chat and sends a simulation command in case it is a known cheat.
 * Hence cheats won't be sent as chat over network.
 *
 * @param {string} text
 * @returns {boolean} - True if a cheat was executed.
 */
function executeCheat(text)
{
	if (g_IsObserver || !g_Players[Engine.GetPlayerID()].cheatsEnabled)
		return false;

	// Find the cheat code that is a prefix of the user input
	let cheatCode = Object.keys(g_Cheats).find(cheatCode => text.indexOf(cheatCode) == 0);
	if (!cheatCode)
		return false;

	let cheat = g_Cheats[cheatCode];

	let parameter = text.substr(cheatCode.length);
	if (cheat.isNumeric)
		parameter = +parameter;

	if (cheat.DefaultParameter && (isNaN(parameter) || parameter <= 0))
		parameter = cheat.DefaultParameter;

	Engine.PostNetworkCommand({
		"type": "cheat",
		"action": cheat.Action,
		"text": cheat.Type,
		"player": Engine.GetPlayerID(),
		"parameter": parameter,
		"templates": cheat.Templates,
		"selected": g_Selection.toList()
	});

	return true;
}

function findGuidForPlayerID(playerID)
{
	return Object.keys(g_PlayerAssignments).find(guid => g_PlayerAssignments[guid].player == playerID);
}

/**
 * Processes all pending simulation messages.
 */
function handleNotifications()
{
	let notifications = Engine.GuiInterfaceCall("GetNotifications");

	for (let notification of notifications)
	{
		if (!notification.type)
		{
			error("Notification without type found.\n"+uneval(notification));
			continue;
		}

		if (!notification.players)
		{
			error("Notification without players found.\n"+uneval(notification));
			continue;
		}

		if (!g_NotificationsTypes[notification.type])
		{
			error("Unknown notification type '" + notification.type + "' found.");
			continue;
		}

		for (let player of notification.players)
			g_NotificationsTypes[notification.type](notification, player);
	}
}

/**
 * Updates playerdata cache and refresh diplomacy panel.
 */
function updateDiplomacy()
{
	g_Players = getPlayerData(g_PlayerAssignments);

	if (g_IsDiplomacyOpen)
		openDiplomacy();
}

/**
 * Displays all active counters (messages showing the remaining time) for wonder-victory, ceasefire etc.
 */
function updateTimeNotifications()
{
	let notifications =  Engine.GuiInterfaceCall("GetTimeNotifications");
	let notificationText = "";
	for (let n of notifications)
	{
		let message = n.message;
		if (n.translateMessage)
			message = translate(message);
		let parameters = n.parameters || {};
		if (n.translateParameters)
			translateObjectKeys(parameters, n.translateParameters);
		parameters.time = timeToString(n.endTime - g_SimState.timeElapsed);
		notificationText += sprintf(message, parameters) + "\n";
	}
	Engine.GetGUIObjectByName("notificationText").caption = notificationText;
}

/**
 * Processes a CNetMessage (see NetMessage.h, NetMessages.h) sent by the CNetServer.
 * Saves the received object to mainlog.html.
 *
 * @param {Object} msg
 */
function handleNetMessage(msg)
{
	log("Net message: " + uneval(msg));

	if (g_NetMessageTypes[msg.type])
		g_NetMessageTypes[msg.type](msg);
	else
		error("Unrecognised net message type '" + msg.type + "'");
}

/**
 * @param {Object} message
 */
function handleNetStatusMessage(message)
{
	if (g_Disconnected)
		return;

	if (!g_StatusMessageTypes[message.status])
	{
		error("Unrecognised netstatus type '" + message.status + "'");
		return;
	}

	let label = Engine.GetGUIObjectByName("netStatus");
	let statusMessage = g_StatusMessageTypes[message.status](message);
	label.caption = statusMessage;
	label.hidden = !statusMessage;

	if (message.status == "disconnected")
	{
		g_Disconnected = true;
		closeChat();
		closeMenu();
		closeOpenDialogs();
	}
}

function handlePlayerAssignmentsMessage(message)
{
	// Find and report all leavings
	for (let guid in g_PlayerAssignments)
	{
		if (message.hosts[guid])
			continue;

		addChatMessage({ "type": "disconnect", "guid": guid });

		for (let id in g_Players)
			if (g_Players[id].guid == guid)
				g_Players[id].offline = true;
	}

	let joins = Object.keys(message.hosts).filter(guid => !g_PlayerAssignments[guid]);

	g_PlayerAssignments = message.hosts;

	// Report all joinings
	joins.forEach(guid => {

		let playerID = g_PlayerAssignments[guid].player;
		if (g_Players[playerID])
		{
			g_Players[playerID].guid = guid;
			g_Players[playerID].name = g_PlayerAssignments[guid].name;
			g_Players[playerID].offline = false;
		}

		addChatMessage({ "type": "connect", "guid": guid });
	});

	// Update lobby gamestatus
	if (g_IsController && Engine.HasXmppClient())
	{
		let players = Object.keys(g_PlayerAssignments).map(guid => g_PlayerAssignments[guid].name);
		Engine.SendChangeStateGame(Object.keys(g_PlayerAssignments).length, players.join(", "));
	}
}

/**
 * Send text as chat. Don't look for commands.
 *
 * @param {string} text
 */
function submitChatDirectly(text)
{
	if (!text.length)
		return;

	if (g_IsNetworked)
		Engine.SendNetworkChat(text);
	else
		addChatMessage({ "type": "message", "guid": "local", "text": text });
}

/**
 * Loads the text from the GUI window, checks if it is a local command
 * or cheat and executes it. Otherwise sends it as chat.
 */
function submitChatInput()
{
	let teamChat = Engine.GetGUIObjectByName("toggleTeamChat").checked;
	let input = Engine.GetGUIObjectByName("chatInput");
	let text = input.caption;

	input.blur(); // Remove focus
	input.caption = ""; // Clear chat input
	toggleChatWindow();

	if (!text.length)
		return;

	if (executeNetworkCommand(text))
		return;

	if (executeCheat(text))
		return;

	// Observers should only be able to chat with everyone.
	if (g_IsObserver && text.indexOf("/") == 0 && text.indexOf("/me ") != 0)
		return;

	if (teamChat && text.indexOf("/team ") != 0)
		text = "/team " + text;

	submitChatDirectly(text);
}

/**
 * Displays the prepared chatmessage.
 *
 * @param msg {Object}
 */
function addChatMessage(msg)
{
	if (!g_FormatChatMessage[msg.type])
		return;

	let formatted = g_FormatChatMessage[msg.type](msg);
	if (!formatted)
		return;

	g_ChatMessages.push(formatted);
	g_ChatTimers.push(setTimeout(removeOldChatMessage, g_ChatTimeout * 1000));

	if (g_ChatMessages.length > g_ChatLines)
		removeOldChatMessage();
	else
		Engine.GetGUIObjectByName("chatText").caption = g_ChatMessages.join("\n");
}

/**
 * Called when the timer has run out for the oldest chatmessage or when the message limit is reached.
 */
function removeOldChatMessage()
{
	clearTimeout(g_ChatTimers[0]);
	g_ChatTimers.shift();
	g_ChatMessages.shift();
	Engine.GetGUIObjectByName("chatText").caption = g_ChatMessages.join("\n");
}

/**
 * This function is used for AIs, whose names don't exist in g_PlayerAssignments.
 */
function colorizePlayernameByID(playerID)
{
	let username = playerID > -1 ? escapeText(g_Players[playerID].name) : translate("Unknown Player");
	let playerColor = playerID > -1 ? rgbToGuiColor(g_Players[playerID].color) : "white";
	return "[color=\"" + playerColor + "\"]" + username + "[/color]";
}

function colorizePlayernameByGUID(guid)
{
	let username = g_PlayerAssignments[guid] ? g_PlayerAssignments[guid].name : translate("Unknown Player");
	let playerID = g_PlayerAssignments[guid] ? g_PlayerAssignments[guid].player : -1;
	let playerColor = playerID > 0 ? rgbToGuiColor(g_Players[playerID].color) : "white";
	return "[color=\"" + playerColor + "\"]" + username + "[/color]";
}

function formatDefeatMessage(msg)
{
	// In singleplayer, the local player is "You". "You has" is incorrect.
	let message = !g_IsNetworked && msg.player == Engine.GetPlayerID() ?
			translate("You have been defeated.") :
			translate("%(player)s has been defeated.");

	return sprintf(message, {
		"player": colorizePlayernameByID(msg.player)
	});
}

function formatDiplomacyMessage(msg)
{
	// Check observer first
	let use = {
		"observer": g_IsObserver,
		"active": Engine.GetPlayerID() == msg.sourcePlayer,
		"passive": Engine.GetPlayerID() == msg.targetPlayer
	};

	let messageType = Object.keys(use).find(v => use[v]);
	if (!messageType)
		return "";

	return sprintf(g_DiplomacyMessages[messageType][msg.status], {
		"player": colorizePlayernameByID(messageType == "active" ? msg.targetPlayer : msg.sourcePlayer),
		"player2": colorizePlayernameByID(messageType == "active" ? msg.sourcePlayer : msg.targetPlayer)
	});
}

function formatTributeMessage(msg)
{
	// Check observer first, since we also want to see if the selected player in the developer-overlay has sent tributes
	let message = "";
	if (g_IsObserver)
		message = translate("%(player)s has sent %(player2)s %(amounts)s.");
	else if (msg.targetPlayer == Engine.GetPlayerID())
		message = translate("%(player)s has sent you %(amounts)s.");

	return sprintf(message, {
		"player": colorizePlayernameByID(msg.sourcePlayer),
		"player2": colorizePlayernameByID(msg.targetPlayer),
		"amounts": getLocalizedResourceAmounts(msg.amounts)
	});
}

function formatAttackMessage(msg)
{
	// TODO: Show this to observers?
	if (msg.player != Engine.GetPlayerID())
		return "";

	let message = msg.targetIsDomesticAnimal ?
			translate("Your livestock has been attacked by %(attacker)s!") :
			translate("You have been attacked by %(attacker)s!");

	return sprintf(message, {
		"attacker": colorizePlayernameByID(msg.attacker)
	});
}

function formatChatCommand(msg)
{
	if (!msg.text)
		return "";

	let isMe = msg.text.indexOf("/me ") == 0;
	if (!isMe && !checkChatAddressee(msg))
		return "";

	isMe = msg.text.indexOf("/me ") == 0;
	if (isMe)
		msg.text = msg.text.substr("/me ".length);

	// Translate or escape text
	if (!msg.text)
		return "";
	if (msg.translate)
	{
		msg.text = translate(msg.text);
		if (msg.translateParameters)
		{
			let parameters = msg.parameters || {};
			translateObjectKeys(parameters, msg.translateParameters);
			msg.text = sprintf(msg.text, parameters);
		}
	}
	else
		msg.text = escapeText(msg.text);

	// GUID for players, playerID for AIs
	let coloredUsername = msg.guid != -1 ? colorizePlayernameByGUID(msg.guid) : colorizePlayernameByID(msg.player);

	return sprintf(g_ChatCommands[isMe ? "me" : "regular"][msg.context ? "context" : "no-context"], {
		"message": msg.text,
		"context": msg.context || undefined,
		"user": coloredUsername,
		"userTag": sprintf(translate("<%(user)s>"), { "user": coloredUsername })
	});
}

/**
 * Checks if the current user is an addressee of the chatmessage sent by another player.
 *
 * @param {Object} msg
 */
function checkChatAddressee(msg)
{
	if (msg.text[0] != '/')
		return true;

	if (g_IsObserver)
		return false;

	let cmd = msg.text.split(/\s/)[0];
	msg.text = msg.text.substr(cmd.length + 1);

	if (cmd == "/ally")
		cmd = "/allies";

	if (cmd == "/enemy")
		cmd = "/enemies";

	// GUID for players, ID for bots
	let senderID = (g_PlayerAssignments[msg.guid] || msg).player;
	let addresseeGUID;
	if (cmd == "/msg")
	{
		addresseeGUID = matchUsername(msg.text);
		let addressee = g_PlayerAssignments[addresseeGUID];
		if (!addressee || addressee.player == -1 || senderID == -1)
			return false;
		msg.text = msg.text.substr(addressee.name.length + 1);
	}

	let isSender = senderID == Engine.GetPlayerID();
	if (!g_ChatAddresseeContext[cmd])
	{
		if (isSender)
			warn("Unknown chat command: " + cmd);
		return false;
	}
	msg.context = g_ChatAddresseeContext[cmd];

	return isSender || g_IsChatAddressee[cmd](senderID, addresseeGUID);
}

/**
 * Returns the guid of the user with the longest name that is a prefix of the given string.
 */
function matchUsername(text)
{
	if (!text)
		return "";

	let match = "";
	let playerGUID = "";
	for (let guid in g_PlayerAssignments)
	{
		let pName = g_PlayerAssignments[guid].name;
		if (text.indexOf(pName + " ") == 0 && pName.length > match.length)
		{
			match = pName;
			playerGUID = guid;
		}
	}
	return playerGUID;
}

/**
 * Unused multiplayer-dialog.
 */
function sendDialogAnswer(guiObject, dialogName)
{
	Engine.GetGUIObjectByName(dialogName+"-dialog").hidden = true;

	Engine.PostNetworkCommand({
		"type": "dialog-answer",
		"dialog": dialogName,
		"answer": guiObject.name.split("-").pop(),
	});

	resumeGame();
}

/**
 * Unused multiplayer-dialog.
 */
function openDialog(dialogName, data, player)
{
	let dialog = Engine.GetGUIObjectByName(dialogName + "-dialog");
	if (!dialog)
	{
		warn("messages.js: Unknow dialog with name " + dialogName);
		return;
	}
	dialog.hidden = false;

	for (let objName in data)
	{
		let obj = Engine.GetGUIObjectByName(dialogName + "-dialog-" + objName);
		if (!obj)
		{
			warn("messages.js: Key '" + objName + "' not found in '" + dialogName + "' dialog.");
			continue;
		}

		for (let key in data[objName])
		{
			let n = data[objName][key];
			if (typeof n == "object" && n.message)
			{
				let message = n.message;
				if (n.translateMessage)
					message = translate(message);
				let parameters = n.parameters || {};
				if (n.translateParameters)
					translateObjectKeys(parameters, n.translateParameters);
				obj[key] = sprintf(message, parameters);
			}
			else
				obj[key] = n;
		}
	}

	pauseGame();
}
