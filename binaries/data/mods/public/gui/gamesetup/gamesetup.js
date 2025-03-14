const g_MatchSettings_SP = "config/matchsettings.json";
const g_MatchSettings_MP = "config/matchsettings.mp.json";

const g_Ceasefire = prepareForDropdown(g_Settings ? g_Settings.Ceasefire : undefined);
const g_GameSpeeds = prepareForDropdown(g_Settings ? g_Settings.GameSpeeds.filter(speed => !speed.ReplayOnly) : undefined);
const g_MapSizes = prepareForDropdown(g_Settings ? g_Settings.MapSizes : undefined);
const g_MapTypes = prepareForDropdown(g_Settings ? g_Settings.MapTypes : undefined);
const g_PopulationCapacities = prepareForDropdown(g_Settings ? g_Settings.PopulationCapacities : undefined);
const g_StartingResources = prepareForDropdown(g_Settings ? g_Settings.StartingResources : undefined);
const g_VictoryConditions = prepareForDropdown(g_Settings ? g_Settings.VictoryConditions : undefined);

/**
 * All selectable playercolors except gaia.
 */
const g_PlayerColors = g_Settings ? g_Settings.PlayerDefaults.slice(1).map(pData => pData.Color) : undefined;

/**
 * Directory containing all maps of the given type.
 */
const g_MapPath = {
	"random": "maps/random/",
	"scenario": "maps/scenarios/",
	"skirmish": "maps/skirmishes/"
};

/**
 * Processes a CNetMessage (see NetMessage.h, NetMessages.h) sent by the CNetServer.
 */
const g_NetMessageTypes = {
	"netstatus": msg => handleNetStatusMessage(msg),
	"gamesetup": msg => handleGamesetupMessage(msg),
	"players": msg => handlePlayerAssignmentMessage(msg),
	"ready": msg => handleReadyMessage(msg),
	"start": msg => handleGamestartMessage(msg),
	"kicked": msg => addChatMessage({ "type": "kicked", "username": msg.username }),
	"banned": msg => addChatMessage({ "type": "banned", "username": msg.username }),
	"chat": msg => addChatMessage({ "type": "chat", "guid": msg.guid, "text": msg.text })
};

const g_FormatChatMessage = {
	"system": (msg, user) => systemMessage(msg.text),
	"settings": (msg, user) => systemMessage(translate('Game settings have been changed')),
	"connect": (msg, user) => systemMessage(sprintf(translate("%(username)s has joined"), { "username": user })),
	"disconnect": (msg, user) => systemMessage(sprintf(translate("%(username)s has left"), { "username": user })),
	"kicked": (msg, user) => systemMessage(sprintf(translate("%(username)s has been kicked"), { "username": user })),
	"banned": (msg, user) => systemMessage(sprintf(translate("%(username)s has been banned"), { "username": user })),
	"chat": (msg, user) => sprintf(translate("%(username)s %(message)s"), {
		"username": senderFont(sprintf(translate("<%(username)s>"), { "username": user })),
		"message": escapeText(msg.text || "")
	}),
	"ready": (msg, user) => sprintf(translate("* %(username)s is ready!"), {
		"username": user
	}),
	"not-ready": (msg, user) => sprintf(translate("* %(username)s is not ready."), {
		"username": user
	}),
	"clientlist": (msg, user) => getUsernameList()
};

/**
 * The dropdownlist items will appear in the order they are added.
 */
const g_MapFilters = [
	{
		"id": "default",
		"name": translate("Default"),
		"filter": mapKeywords => mapKeywords.every(keyword => ["naval", "demo", "hidden"].indexOf(keyword) == -1)
	},
	{
		"id": "naval",
		"name": translate("Naval Maps"),
		"filter": mapKeywords => mapKeywords.indexOf("naval") != -1
	},
	{
		"id": "demo",
		"name": translate("Demo Maps"),
		"filter": mapKeywords => mapKeywords.indexOf("demo") != -1
	},
	{
		"id": "all",
		"name": translate("All Maps"),
		"filter": mapKeywords => true
	}
];

/**
 * Used for generating the botnames.
 */
const g_RomanNumbers = [undefined, "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/**
 * Offer users to select playable civs only.
 * Load unselectable civs as they could appear in scenario maps.
 */
const g_CivData = loadCivData();

/**
 * Used for highlighting the sender of chat messages.
 */
const g_SenderFont = "sans-bold-13";

/**
 * Highlight the "random" dropdownlist item.
 */
const g_ColorRandom = "orange";

/**
 * Highlight AIs in the player-dropdownlist.
 */
const g_AIColor = "70 150 70";

/**
 * Highlight unassigned players in the dropdownlist.
 */
const g_UnassignedColor = "140 140 140";

/**
 * Highlight ready players.
 */
const g_ReadyColor = "green";

/**
 * Highlights the victory condition in the game-description.
 */
const g_VictoryColor = "orange";

/**
 * Placeholder item for the map-dropdownlist.
 */
const g_RandomMap = '[color="' + g_ColorRandom + '"]' + translateWithContext("map", "Random") + "[/color]";

/**
 * Placeholder item for the civ-dropdownlists.
 */
const g_RandomCiv = '[color="' + g_ColorRandom + '"]' + translateWithContext("civilization", "Random") + '[/color]';

// Is this is a networked game, or offline
var g_IsNetworked;

// Is this user in control of game settings (i.e. is a network server, or offline player)
var g_IsController;

// Server name, if user is a server, connected to the multiplayer lobby
var g_ServerName;

// Are we currently updating the GUI in response to network messages instead of user input
// (and therefore shouldn't send further messages to the network)
var g_IsInGuiUpdate;

// Is this user ready
var g_IsReady;

// There are some duplicate orders on init, we can ignore these [bool].
var g_ReadyInit = true;

// If no one has changed ready status, we have no need to spam the settings changed message.
// 2 - Host's initial ready, suppressed settings message, 1 - Will show settings message, <=0 - Suppressed settings message
var g_ReadyChanged = 2;

/**
 * Used to prevent calling resetReadyData when starting a game.
 */
var g_GameStarted = false;

var g_PlayerAssignments = {};

var g_DefaultPlayerData = [];

var g_GameAttributes = { "settings": {} };

var g_ChatMessages = [];

/**
 * Cache containing the mapsettings for scenario/skirmish maps. Just-in-time loading.
 */
var g_MapData = {};

// To prevent the display locking up while we load the map metadata,
// we'll start with a 'loading' message and switch to the main screen in the
// tick handler
var g_LoadingState = 0; // 0 = not started, 1 = loading, 2 = loaded

/**
 * Initializes some globals without touching the GUI.
 *
 * @param {Object} attribs - context data sent by the lobby / mainmenu
 */
function init(attribs)
{
	if (!g_Settings)
	{
		cancelSetup();
		return;
	}

	if (["offline", "server", "client"].indexOf(attribs.type) == -1)
	{
		error("Unexpected 'type' in gamesetup init: " + attribs.type);
		cancelSetup();
		return;
	}

	g_IsNetworked = attribs.type != "offline";
	g_IsController = attribs.type != "client";

	if (attribs.serverName)
		g_ServerName = attribs.serverName;

	// Get default player data - remove gaia
	g_DefaultPlayerData = g_Settings.PlayerDefaults;
	g_DefaultPlayerData.shift();
	for (let i in g_DefaultPlayerData)
		g_DefaultPlayerData[i].Civ = "random";
}

/**
 * Called after the first tick.
 */
function initGUIObjects()
{
	Engine.GetGUIObjectByName("cancelGame").tooltip = Engine.HasXmppClient() ? translate("Return to the lobby.") : translate("Return to the main menu.");

	initCivNameList();
	initMapTypes();
	initMapFilters();

	if (g_IsController)
	{
		// Unique ID to be used for identifying the same game reports for the lobby
		g_GameAttributes.matchID = Engine.GetMatchID();
		g_GameAttributes.settings.CheatsEnabled = !g_IsNetworked;
		g_GameAttributes.settings.RatingEnabled = Engine.IsRankedGame() || undefined;

		initMapNameList();
		initNumberOfPlayers();
		initGameSpeed();
		initPopulationCaps();
		initStartingResources();
		initCeasefire();
		initVictoryConditions();
		initMapSizes();
		initRadioButtons();
	}
	else
		hideControls();

	initMultiplayerSettings();
	initPlayerAssignments();

	resizeMoreOptionsWindow();

	if (g_IsNetworked)
		Engine.GetGUIObjectByName("chatInput").focus();

	if (g_IsController)
	{
		loadPersistMatchSettings();
		if (g_IsInGuiUpdate)
			warn("initGUIObjects() called while in GUI update");
		updateGameAttributes();
	}
}

function initMapTypes()
{
	let mapTypes = Engine.GetGUIObjectByName("mapTypeSelection");
	mapTypes.list = g_MapTypes.Title;
	mapTypes.list_data = g_MapTypes.Name;
	mapTypes.onSelectionChange = function() {
		if (this.selected != -1)
			selectMapType(this.list_data[this.selected]);
	};
	if (g_IsController)
		mapTypes.selected = g_MapTypes.Default;
}

function initMapFilters()
{
	let mapFilters = Engine.GetGUIObjectByName("mapFilterSelection");
	mapFilters.list = g_MapFilters.map(mapFilter => mapFilter.name);
	mapFilters.list_data = g_MapFilters.map(mapFilter => mapFilter.id);
	mapFilters.onSelectionChange = function() {
		if (this.selected != -1)
			selectMapFilter(this.list_data[this.selected]);
	};
	if (g_IsController)
		mapFilters.selected = 0;
	g_GameAttributes.mapFilter = "default";
}

/**
 * Sets the size of the more-options dialog.
 */
function resizeMoreOptionsWindow()
{
	// For singleplayer reduce the size of more options dialog by three options (cheats, rated game, observer late join = 90px)
	if (!g_IsNetworked)
	{
		Engine.GetGUIObjectByName("moreOptions").size = "50%-200 50%-195 50%+200 50%+160";
		Engine.GetGUIObjectByName("hideMoreOptions").size = "50%-70 310 50%+70 336";
	}
	// For non-lobby multiplayergames reduce the size of the dialog by one option (rated game, 30px)
	else if (!Engine.HasXmppClient())
	{
		Engine.GetGUIObjectByName("moreOptions").size = "50%-200 50%-195 50%+200 50%+220";
		Engine.GetGUIObjectByName("hideMoreOptions").size = "50%-70 370 50%+70 396";
		Engine.GetGUIObjectByName("optionObserverLateJoin").size = "14 338 94% 366";
	}
}

function initNumberOfPlayers()
{
	let playersArray = Array(g_MaxPlayers).fill(0).map((v, i) => i + 1); // 1, 2, ..., MaxPlayers
	let numPlayersSelection = Engine.GetGUIObjectByName("numPlayersSelection");
	numPlayersSelection.list = playersArray;
	numPlayersSelection.list_data = playersArray;
	numPlayersSelection.onSelectionChange = function() {
		if (this.selected != -1)
			selectNumPlayers(this.list_data[this.selected]);
	};
	numPlayersSelection.selected = g_MaxPlayers - 1;
}

function initGameSpeed()
{
	let gameSpeed = Engine.GetGUIObjectByName("gameSpeed");
	gameSpeed.hidden = false;
	Engine.GetGUIObjectByName("gameSpeedText").hidden = true;
	gameSpeed.list = g_GameSpeeds.Title;
	gameSpeed.list_data = g_GameSpeeds.Speed;
	gameSpeed.onSelectionChange = function() {
		if (this.selected != -1)
			g_GameAttributes.gameSpeed = g_GameSpeeds.Speed[this.selected];

		updateGameAttributes();
	};
	gameSpeed.selected = g_GameSpeeds.Default;
}

function initPopulationCaps()
{
	let populationCaps = Engine.GetGUIObjectByName("populationCap");
	populationCaps.list = g_PopulationCapacities.Title;
	populationCaps.list_data = g_PopulationCapacities.Population;
	populationCaps.selected = g_PopulationCapacities.Default;
	populationCaps.onSelectionChange = function() {
		if (this.selected != -1)
			g_GameAttributes.settings.PopulationCap = g_PopulationCapacities.Population[this.selected];

		updateGameAttributes();
	};
}

function initStartingResources()
{
	let startingResourcesL = Engine.GetGUIObjectByName("startingResources");
	startingResourcesL.list = g_StartingResources.Title;
	startingResourcesL.list_data = g_StartingResources.Resources;
	startingResourcesL.selected = g_StartingResources.Default;
	startingResourcesL.onSelectionChange = function() {
		if (this.selected != -1)
			g_GameAttributes.settings.StartingResources = g_StartingResources.Resources[this.selected];

		updateGameAttributes();
	};
}

function initCeasefire()
{
	let ceasefireL = Engine.GetGUIObjectByName("ceasefire");
	ceasefireL.list = g_Ceasefire.Title;
	ceasefireL.list_data = g_Ceasefire.Duration;
	ceasefireL.selected = g_Ceasefire.Default;
	ceasefireL.onSelectionChange = function() {
		if (this.selected != -1)
			g_GameAttributes.settings.Ceasefire = g_Ceasefire.Duration[this.selected];

		updateGameAttributes();
	};
}

function initVictoryConditions()
{
	let victoryConditions = Engine.GetGUIObjectByName("victoryCondition");
	victoryConditions.list = g_VictoryConditions.Title;
	victoryConditions.list_data = g_VictoryConditions.Name;
	victoryConditions.onSelectionChange = function() {
		if (this.selected != -1)
		{
			g_GameAttributes.settings.GameType = g_VictoryConditions.Name[this.selected];
			g_GameAttributes.settings.VictoryScripts = g_VictoryConditions.Scripts[this.selected];
		}

		updateGameAttributes();
	};
	victoryConditions.selected = g_VictoryConditions.Default;
}

function initMapSizes()
{
	let mapSize = Engine.GetGUIObjectByName("mapSize");
	mapSize.list = g_MapSizes.LongName;
	mapSize.list_data = g_MapSizes.Tiles;
	mapSize.onSelectionChange = function() {
		if (this.selected != -1)
			g_GameAttributes.settings.Size = g_MapSizes.Tiles[this.selected];
		updateGameAttributes();
	};
	mapSize.selected = 0;
}

/**
 * Assign update-functions to all checkboxes.
 */
function initRadioButtons()
{
	let options = {
		"RevealMap": "revealMap",
		"ExploreMap": "exploreMap",
		"DisableTreasures": "disableTreasures",
		"LockTeams": "lockTeams",
		"CheatsEnabled": "enableCheats",
		"ObserverLateJoin": "observerLateJoin"
	};

	Object.keys(options).forEach(attribute => {
		Engine.GetGUIObjectByName(options[attribute]).onPress = function() {
			g_GameAttributes.settings[attribute] = this.checked;
			updateGameAttributes();
		};
	});

	Engine.GetGUIObjectByName("enableRating").onPress = function() {
		g_GameAttributes.settings.RatingEnabled = this.checked;
		Engine.SetRankedGame(this.checked);
		Engine.GetGUIObjectByName("enableCheats").enabled = !this.checked;
		Engine.GetGUIObjectByName("lockTeams").enabled = !this.checked;
		updateGameAttributes();
	};
}

/**
 * If we're a network client, hide the controls and show the text instead.
 */
function hideControls()
{
	hideControl("mapTypeSelection", "mapTypeText");
	hideControl("mapFilterSelection", "mapFilterText");
	hideControl("mapSelection", "mapSelectionText");
	hideControl("victoryCondition", "victoryConditionText");
	hideControl("gameSpeed", "gameSpeedText");
	hideControl("numPlayersSelection", "numPlayersText");

	// TODO: Shouldn't players be able to choose their own assignment?
	for (let i = 0; i < g_MaxPlayers; ++i)
	{
		Engine.GetGUIObjectByName("playerAssignment["+i+"]").hidden = true;
		Engine.GetGUIObjectByName("playerCiv["+i+"]").hidden = true;
		Engine.GetGUIObjectByName("playerTeam["+i+"]").hidden = true;
	}

	Engine.GetGUIObjectByName("startGame").enabled = true;
}

/**
 * Hides the GUI controls for clients and shows the read-only label instead.
 *
 * @param {string} control - name of the GUI object able to change a setting
 * @param {string} label - name of the GUI object displaying a setting
 * @param {boolean} [allowControl] - Whether the current user is allowed to change the control.
 */
function hideControl(control, label, allowControl = g_IsController)
{
	Engine.GetGUIObjectByName(control).hidden = !allowControl;
	Engine.GetGUIObjectByName(label).hidden = allowControl;
}

/**
 * Checks a boolean checkbox for the host and sets the text of the label for the client.
 *
 * @param {string} control - name of the GUI object able to change a setting
 * @param {string} label - name of the GUI object displaying a setting
 * @param {boolean} checked - Whether the setting is active / enabled.
 */
function setGUIBoolean(control, label, checked)
{
	Engine.GetGUIObjectByName(control).checked = checked;
	Engine.GetGUIObjectByName(label).caption = checked ? translate("Yes") : translate("No");
}

/**
 * Hide and set some elements depending on whether we play single- or multiplayer.
 */
function initMultiplayerSettings()
{
	Engine.GetGUIObjectByName("chatPanel").hidden = !g_IsNetworked;
	Engine.GetGUIObjectByName("optionCheats").hidden = !g_IsNetworked;
	Engine.GetGUIObjectByName("optionRating").hidden = !Engine.HasXmppClient();
	Engine.GetGUIObjectByName("optionObserverLateJoin").hidden = !g_IsNetworked;

	Engine.GetGUIObjectByName("enableCheats").enabled = !Engine.IsRankedGame();
	Engine.GetGUIObjectByName("lockTeams").enabled = !Engine.IsRankedGame();

	Engine.GetGUIObjectByName("enableCheats").checked = g_GameAttributes.settings.CheatsEnabled;
	Engine.GetGUIObjectByName("enableRating").checked = !!g_GameAttributes.settings.RatingEnabled;

	hideControl("enableCheats", "enableCheatsText");
	hideControl("enableRating", "enableRatingText");
	hideControl("observerLateJoin", "observerLateJoinText");
}

/**
 * Populate team-, color- and civ-dropdowns.
 */
function initPlayerAssignments()
{
	let boxSpacing = 32;
	for (let i = 0; i < g_MaxPlayers; ++i)
	{
		let box = Engine.GetGUIObjectByName("playerBox["+i+"]");
		let boxSize = box.size;
		let h = boxSize.bottom - boxSize.top;
		boxSize.top = i * boxSpacing;
		boxSize.bottom = i * boxSpacing + h;
		box.size = boxSize;

		let team = Engine.GetGUIObjectByName("playerTeam["+i+"]");
		let teamsArray = Array(g_MaxTeams).fill(0).map((v, i) => i + 1); // 1, 2, ... MaxTeams
		team.list = [translateWithContext("team", "None")].concat(teamsArray); // "None", 1, 2, ..., maxTeams
		team.list_data = [-1].concat(teamsArray.map(team => team - 1)); // -1, 0, ..., (maxTeams-1)
		team.selected = 0;

		let playerSlot = i;	// declare for inner function use
		team.onSelectionChange = function() {
			if (this.selected != -1)
				g_GameAttributes.settings.PlayerData[playerSlot].Team = this.selected - 1;

			updateGameAttributes();
		};

		let colorPicker = Engine.GetGUIObjectByName("playerColorPicker["+i+"]");
		colorPicker.list = g_PlayerColors.map(color => '[color="' + color.r + ' ' + color.g + ' ' + color.b + '"] ■[/color]');
		colorPicker.list_data = g_PlayerColors.map((color, index) => index);
		colorPicker.selected = -1;
		colorPicker.onSelectionChange = function() { selectPlayerColor(playerSlot, this.selected); };

		Engine.GetGUIObjectByName("playerCiv["+i+"]").onSelectionChange = function() {
			if ((this.selected != -1)&&(g_GameAttributes.mapType !== "scenario"))
				g_GameAttributes.settings.PlayerData[playerSlot].Civ = this.list_data[this.selected];

			updateGameAttributes();
		};
	}
}

/**
 * Called when the client disconnects.
 * The other cases from NetClient should never occur in the gamesetup.
 * @param {Object} message
 */
function handleNetStatusMessage(message)
{
	if (message.status != "disconnected")
	{
		error("Unrecognised netstatus type " + message.status);
		return;
	}

	cancelSetup();
	reportDisconnect(message.reason);
}

/**
 * Called whenever a client clicks on ready (or not ready).
 * @param {Object} message
 */
function handleReadyMessage(message)
{
	g_ReadyChanged -= 1;

	if (g_ReadyChanged < 1 && g_PlayerAssignments[message.guid].player != -1)
		addChatMessage({
			"type": message.status == 1 ? "ready" : "not-ready",
			"guid": message.guid
		});

	if (!g_IsController)
		return;

	g_PlayerAssignments[message.guid].status = +message.status == 1;
	Engine.SetNetworkPlayerStatus(message.guid, +message.status);
	updateReadyUI();
}

/**
 * Called after every player is ready and the host decided to finally start the game.
 * @param {Object} message
 */
function handleGamestartMessage(message)
{
	if (g_IsController && Engine.HasXmppClient())
	{
		let playerNames = Object.keys(g_PlayerAssignments).map(guid => g_PlayerAssignments[guid].name);
		Engine.SendChangeStateGame(playerNames.length, playerNames.join(", "));
	}

	Engine.SwitchGuiPage("page_loading.xml", {
		"attribs": g_GameAttributes,
		"isNetworked" : g_IsNetworked,
		"playerAssignments": g_PlayerAssignments,
		"isController": g_IsController
	});
}

/**
 * Called whenever the host changed any setting.
 * @param {Object} message
 */
function handleGamesetupMessage(message)
{
	if (!message.data)
		return;

	g_GameAttributes = message.data;

	if (!!g_GameAttributes.settings.RatingEnabled)
	{
		g_GameAttributes.settings.CheatsEnabled = false;
		g_GameAttributes.settings.LockTeams = true;
	}

	Engine.SetRankedGame(!!g_GameAttributes.settings.RatingEnabled);

	updateGUIObjects();
}

/**
 * Called whenever a client joins/leaves or any gamesetting is changed.
 * @param {Object} message
 */
function handlePlayerAssignmentMessage(message)
{
	let resetReady = false;
	let newGUID = "";

	// Report joinings
	for (let guid in message.hosts)
	{
		if (g_PlayerAssignments[guid])
			continue;

		addChatMessage({ "type": "connect", "guid": guid, "username": message.hosts[guid].name });
		newGUID = guid;

		// Assign the new player
		if (!g_IsController || message.hosts[guid].player != -1)
			continue;

		let freeSlot = g_GameAttributes.settings.PlayerData.findIndex((v,i) =>
			Object.keys(g_PlayerAssignments).every(guid => g_PlayerAssignments[guid].player != i+1)
		);

		if (freeSlot != -1)
			Engine.AssignNetworkPlayer(freeSlot+1, guid);
	}

	// Report leavings
	for (let guid in g_PlayerAssignments)
	{
		if (message.hosts[guid])
			continue;

		addChatMessage({ "type": "disconnect", "guid": guid });

		if (g_PlayerAssignments[guid].player != -1)
			resetReady = true; // Observers shouldn't reset ready.
	}

	g_PlayerAssignments = message.hosts;
	updatePlayerList();

	if (g_PlayerAssignments[newGUID] && g_PlayerAssignments[newGUID].player != -1)
		resetReady = true;

	if (resetReady)
		resetReadyData();

	updateReadyUI();

	sendRegisterGameStanza();
}

function getMapDisplayName(map)
{
	let mapData = loadMapData(map);
	if (!mapData || !mapData.settings || !mapData.settings.Name)
	{
		log("Map data missing in scenario '" + map + "' - likely unsupported format");
		return map;
	}

	return mapData.settings.Name;
}

function getMapPreview(map)
{
	let mapData = loadMapData(map);
	if (!mapData || !mapData.settings || !mapData.settings.Preview)
		return "nopreview.png";

	return mapData.settings.Preview;
}

// Get a setting if it exists or return default
function getSetting(settings, defaults, property)
{
	if (settings && (property in settings))
		return settings[property];

	if (defaults && (property in defaults))
		return defaults[property];

	return undefined;
}

/**
 * Initialize the dropdowns containing all selectable civs (including random).
 */
function initCivNameList()
{
	let civList = Object.keys(g_CivData).filter(civ => g_CivData[civ].SelectableInGameSetup).map(civ => ({ "name": g_CivData[civ].Name, "code": civ })).sort(sortNameIgnoreCase);
	let civListNames = [g_RandomCiv].concat(civList.map(civ => civ.name));
	let civListCodes = ["random"].concat(civList.map(civ => civ.code));

	for (let i = 0; i < g_MaxPlayers; ++i)
	{
		let civ = Engine.GetGUIObjectByName("playerCiv["+i+"]");
		civ.list = civListNames;
		civ.list_data = civListCodes;
		civ.selected = 0;
	}
}

/**
 * Initialize the dropdown containing all maps for the selected maptype and mapfilter.
 */
function initMapNameList()
{
	if (!g_MapPath[g_GameAttributes.mapType])
	{
		error("initMapNameList: Unexpected map type " + g_GameAttributes.mapType);
		return;
	}

	let mapFiles = g_GameAttributes.mapType == "random" ? getJSONFileList(g_GameAttributes.mapPath) : getXMLFileList(g_GameAttributes.mapPath);

	// Apply map filter, if any defined
	// TODO: Should verify these are valid maps before adding to list
	let mapList = [];
	for (let mapFile of mapFiles)
	{
		let file = g_GameAttributes.mapPath + mapFile;
		let mapData = loadMapData(file);
		let mapFilter = g_MapFilters.find(mapFilter => mapFilter.id == (g_GameAttributes.mapFilter || "all"));

		if (!!mapData.settings && mapFilter && mapFilter.filter(mapData.settings.Keywords || []))
			mapList.push({ "name": getMapDisplayName(file), "file": file });
	}

	translateObjectKeys(mapList, ["name"]);
	mapList.sort(sortNameIgnoreCase);

	let mapListNames = mapList.map(map => map.name);
	let mapListFiles = mapList.map(map => map.file);

	// Scenario/skirmish maps have a fixed playercount
	if (g_GameAttributes.mapType == "random")
	{
		mapListNames.unshift(g_RandomMap);
		mapListFiles.unshift("random");
	}

	let mapSelectionBox = Engine.GetGUIObjectByName("mapSelection");
	mapSelectionBox.list = mapListNames;
	mapSelectionBox.list_data = mapListFiles;
	mapSelectionBox.onSelectionChange = function() {
		if (this.selected != -1)
			selectMap(this.list_data[this.selected]);
	};
	mapSelectionBox.selected = Math.max(0, mapListFiles.indexOf(g_GameAttributes.map || ""));
}

function loadMapData(name)
{
	if (!name || !g_MapPath[g_GameAttributes.mapType])
		return undefined;

	if (name == "random")
		return { "settings": { "Name": "", "Description": "" } };

	if (!g_MapData[name])
		g_MapData[name] = g_GameAttributes.mapType == "random" ? Engine.ReadJSONFile(name + ".json") : Engine.LoadMapSettings(name);

	return g_MapData[name];
}

/**
 * Sets the gameattributes the way they were the last time the user left the gamesetup.
 */
function loadPersistMatchSettings()
{
	if (Engine.ConfigDB_GetValue("user", "persistmatchsettings") != "true")
		return;

	let settingsFile = g_IsNetworked ? g_MatchSettings_MP : g_MatchSettings_SP;
	if (!Engine.FileExists(settingsFile))
		return;

	let attrs = Engine.ReadJSONFile(settingsFile);
	if (!attrs || !attrs.settings)
		return;

	g_IsInGuiUpdate = true;

	let mapName = attrs.map || "";
	let mapSettings = attrs.settings;

	g_GameAttributes = attrs;
	g_GameAttributes.matchID = Engine.GetMatchID();
	mapSettings.Seed = Math.floor(Math.random() * 65536);
	mapSettings.AISeed = Math.floor(Math.random() * 65536);

	if (!g_IsNetworked)
		mapSettings.CheatsEnabled = true;

	// Replace unselectable civs with random civ
	let playerData = mapSettings.PlayerData;
	if (playerData && g_GameAttributes.mapType != "scenario")
		for (let i in playerData)
			if (!g_CivData[playerData[i].Civ] || !g_CivData[playerData[i].Civ].SelectableInGameSetup)
				playerData[i].Civ = "random";

	// Apply map settings
	let newMapData = loadMapData(mapName);
	if (newMapData && newMapData.settings)
	{
		for (let prop in newMapData.settings)
			mapSettings[prop] = newMapData.settings[prop];

		if (playerData)
			mapSettings.PlayerData = playerData;
	}

	if (mapSettings.PlayerData)
		sanitizePlayerData(mapSettings.PlayerData);

	// Reload, as the maptype or mapfilter might have changed
	initMapNameList();

	g_GameAttributes.settings.RatingEnabled = Engine.HasXmppClient();
	Engine.SetRankedGame(g_GameAttributes.settings.RatingEnabled);

	updateGUIObjects();
}

function savePersistMatchSettings()
{
	let attributes = Engine.ConfigDB_GetValue("user", "persistmatchsettings") == "true" ? g_GameAttributes : {};
	Engine.WriteJSONFile(g_IsNetworked ? g_MatchSettings_MP : g_MatchSettings_SP, attributes);
}

function sanitizePlayerData(playerData)
{
	// Remove gaia
	if (playerData.length && !playerData[0])
		playerData.shift();

	playerData.forEach((pData, index) => {
		pData.Color = pData.Color || g_PlayerColors[index];
		pData.Civ = pData.Civ || "random";
	});

	// Replace colors with the best matching color of PlayerDefaults
	if (g_GameAttributes.mapType != "scenario")
	{
		playerData.forEach((pData, index) => {
			let colorDistances = g_PlayerColors.map(color => colorDistance(color, pData.Color));
			let smallestDistance = colorDistances.find(distance => colorDistances.every(distance2 => (distance2 >= distance)));
			pData.Color = g_PlayerColors.find(color => colorDistance(color, pData.Color) == smallestDistance);
		});
	}

	ensureUniquePlayerColors(playerData);
}

function cancelSetup()
{
	if (g_IsController)
		savePersistMatchSettings();

	Engine.DisconnectNetworkGame();

	if (Engine.HasXmppClient())
	{
		Engine.LobbySetPlayerPresence("available");

		if (g_IsController)
			Engine.SendUnregisterGame();

		Engine.SwitchGuiPage("page_lobby.xml");
	}
	else
		Engine.SwitchGuiPage("page_pregame.xml");
}

function onTick()
{
	if (!g_Settings)
		return;

	// First tick happens before first render, so don't load yet
	if (g_LoadingState == 0)
	{
		g_LoadingState++;
	}
	else if (g_LoadingState == 1)
	{
		Engine.GetGUIObjectByName("loadingWindow").hidden = true;
		Engine.GetGUIObjectByName("setupWindow").hidden = false;
		initGUIObjects();
		g_LoadingState++;
	}
	else if (g_LoadingState == 2)
	{
		while (true)
		{
			let message = Engine.PollNetworkClient();
			if (!message)
				break;

			log("Net message: " + uneval(message));

			if (g_NetMessageTypes[message.type])
				g_NetMessageTypes[message.type](message);
			else
				error("Unrecognised net message type " + message.type);
		}
	}
}

/**
 * Called when the host choses the number of players on a random map.
 * @param {Number} num
 */
function selectNumPlayers(num)
{
	// Avoid recursion
	if (g_IsInGuiUpdate || !g_IsController || g_GameAttributes.mapType != "random")
		return;

	// Unassign players from nonexistent slots
	if (g_IsNetworked)
	{
		for (let i = g_MaxPlayers; i > num; --i)
			Engine.AssignNetworkPlayer(i, "");
	}
	else if (g_PlayerAssignments.local.player > num)
		g_PlayerAssignments.local.player = 1;

	// Update player data
	let pData = g_GameAttributes.settings.PlayerData;
	if (num < pData.length)
		g_GameAttributes.settings.PlayerData = pData.slice(0, num);
	else
		for (let i = pData.length; i < num; ++i)
			g_GameAttributes.settings.PlayerData.push(g_DefaultPlayerData[i]);

	updateGameAttributes();
}

/**
 *  Assigns the given color to that player.
 */
function selectPlayerColor(playerSlot, colorIndex)
{
	if (colorIndex == -1)
		return;

	let playerData = g_GameAttributes.settings.PlayerData;

	// If someone else has that color, give that player the old color
	let pData = playerData.find(pData => sameColor(g_PlayerColors[colorIndex], pData.Color));
	if (pData)
		pData.Color = playerData[playerSlot].Color;

	// Assign the new color
	playerData[playerSlot].Color = g_PlayerColors[colorIndex];

	// Ensure colors are not used twice after increasing the number of players
	ensureUniquePlayerColors(playerData);

	if (!g_IsInGuiUpdate)
		updateGameAttributes();
}

function ensureUniquePlayerColors(playerData)
{
	for (let i = playerData.length - 1; i >= 0; --i)
		// If someone else has that color, assign an unused color
		if (playerData.some((pData, j) => i != j && sameColor(playerData[i].Color, pData.Color)))
			playerData[i].Color = g_PlayerColors.find(color => playerData.every(pData => !sameColor(color, pData.Color)));
}

/**
 * Called when the user selects a map type from the list.
 *
 * @param {string} type - scenario, skirmish or random
 */
function selectMapType(type)
{
	// Avoid recursion
	if (g_IsInGuiUpdate || !g_IsController)
		return;

	if (!g_MapPath[type])
	{
		error("selectMapType: Unexpected map type " + type);
		return;
	}

	g_MapData = {};
	g_GameAttributes.map = "";
	g_GameAttributes.mapType = type;
	g_GameAttributes.mapPath = g_MapPath[type];

	if (type != "scenario")
		g_GameAttributes.settings = {
			"PlayerData": g_DefaultPlayerData.slice(0, 4),
			"Seed": Math.floor(Math.random() * 65536),
			"CheatsEnabled": g_GameAttributes.settings.CheatsEnabled
		};
	g_GameAttributes.settings.AISeed = Math.floor(Math.random() * 65536);

	initMapNameList();

	updateGameAttributes();
}

function selectMapFilter(id)
{
	// Avoid recursion
	if (g_IsInGuiUpdate || !g_IsController)
		return;

	g_GameAttributes.mapFilter = id;

	initMapNameList();

	updateGameAttributes();
}

// Called when the user selects a map from the list
function selectMap(name)
{
	// Avoid recursion
	if (g_IsInGuiUpdate || !g_IsController || !name)
		return;

	// Reset some map specific properties which are not necessarily redefined on each map
	for (let prop of ["TriggerScripts", "CircularMap", "Garrison"])
		g_GameAttributes.settings[prop] = undefined;

	let mapData = loadMapData(name);
	let mapSettings = mapData && mapData.settings ? deepcopy(mapData.settings) : {};

	// Reset victory conditions
	if (g_GameAttributes.mapType != "random")
	{
		let victoryIdx = g_VictoryConditions.Name.indexOf(mapSettings.GameType || "") != -1 ? g_VictoryConditions.Name.indexOf(mapSettings.GameType) : g_VictoryConditions.Default;
		g_GameAttributes.settings.GameType = g_VictoryConditions.Name[victoryIdx];
		g_GameAttributes.settings.VictoryScripts = g_VictoryConditions.Scripts[victoryIdx];
	}

	if (mapSettings.PlayerData)
		sanitizePlayerData(mapSettings.PlayerData);

	// Copy any new settings
	g_GameAttributes.map = name;
	g_GameAttributes.script = mapSettings.Script;
	if (g_GameAttributes.map !== "random")
		for (let prop in mapSettings)
			g_GameAttributes.settings[prop] = mapSettings[prop];

	// Use default AI if the map doesn't specify any explicitly
	for (let i in g_GameAttributes.settings.PlayerData)
	{
		if (!('AI' in g_GameAttributes.settings.PlayerData[i]))
			g_GameAttributes.settings.PlayerData[i].AI = g_DefaultPlayerData[i].AI;
		if (!('AIDiff' in g_GameAttributes.settings.PlayerData[i]))
			g_GameAttributes.settings.PlayerData[i].AIDiff = g_DefaultPlayerData[i].AIDiff;
	}

	// Reset player assignments on map change
	if (!g_IsNetworked)
		g_PlayerAssignments = { "local": { "name": translate("You"), "player": 1, "civ": "", "team": -1, "ready": 0 } };
	else
	{
		let numPlayers = mapSettings.PlayerData ? mapSettings.PlayerData.length : g_GameAttributes.settings.PlayerData.length;

		for (let guid in g_PlayerAssignments)
		{	// Unassign extra players
			let player = g_PlayerAssignments[guid].player;
			if (player <= g_MaxPlayers && player > numPlayers)
				Engine.AssignNetworkPlayer(player, "");
		}
	}

	updateGameAttributes();
}

function launchGame()
{
	if (!g_IsController)
	{
		error("Only host can start game");
		return;
	}

	if (!g_GameAttributes.map)
		return;

	savePersistMatchSettings();

	// Select random map
	if (g_GameAttributes.map == "random")
	{
		let victoryScriptsSelected = g_GameAttributes.settings.VictoryScripts;
		let gameTypeSelected = g_GameAttributes.settings.GameType;
		selectMap(Engine.GetGUIObjectByName("mapSelection").list_data[Math.floor(Math.random() *
			(Engine.GetGUIObjectByName("mapSelection").list.length - 1)) + 1]);
		g_GameAttributes.settings.VictoryScripts = victoryScriptsSelected;
		g_GameAttributes.settings.GameType = gameTypeSelected;
	}

	g_GameAttributes.settings.TriggerScripts = g_GameAttributes.settings.VictoryScripts.concat(g_GameAttributes.settings.TriggerScripts || []);

	// Prevent reseting the readystate
	g_GameStarted = true;

	g_GameAttributes.settings.mapType = g_GameAttributes.mapType;

	// Get a unique array of selectable cultures
	let cultures = Object.keys(g_CivData).filter(civ => g_CivData[civ].SelectableInGameSetup).map(civ => g_CivData[civ].Culture);
	cultures = cultures.filter((culture, index) => cultures.indexOf(culture) === index);

	// Determine random civs and botnames
	for (let i in g_GameAttributes.settings.PlayerData)
	{
		// Pick a random civ of a random culture
		let chosenCiv = g_GameAttributes.settings.PlayerData[i].Civ || "random";
		if (chosenCiv == "random")
		{
			let culture = cultures[Math.floor(Math.random() * cultures.length)];
			let civs = Object.keys(g_CivData).filter(civ => g_CivData[civ].Culture == culture);
			chosenCiv = civs[Math.floor(Math.random() * civs.length)];
		}
		g_GameAttributes.settings.PlayerData[i].Civ = chosenCiv;

		// Pick one of the available botnames for the chosen civ
		if (g_GameAttributes.mapType === "scenario" || !g_GameAttributes.settings.PlayerData[i].AI)
			continue;

		let chosenName = g_CivData[chosenCiv].AINames[Math.floor(Math.random() * g_CivData[chosenCiv].AINames.length)];

		if (!g_IsNetworked)
			chosenName = translate(chosenName);

		// Count how many players use the chosenName
		let usedName = g_GameAttributes.settings.PlayerData.filter(pData => pData.Name && pData.Name.indexOf(chosenName) !== -1).length;

		g_GameAttributes.settings.PlayerData[i].Name = !usedName ? chosenName : sprintf(translate("%(playerName)s %(romanNumber)s"), { "playerName": chosenName, "romanNumber": g_RomanNumbers[usedName+1] });
	}

	// Copy playernames from initial player assignment to the settings
	for (let guid in g_PlayerAssignments)
	{
		let player = g_PlayerAssignments[guid];
		if (player.player > 0)	// not observer or GAIA
			g_GameAttributes.settings.PlayerData[player.player - 1].Name = player.name;
	}

	if (g_IsNetworked)
	{
		Engine.SetNetworkGameAttributes(g_GameAttributes);
		Engine.StartNetworkGame();
	}
	else
	{
		// Find the player ID which the user has been assigned to
		let playerID = -1;
		for (let i in g_GameAttributes.settings.PlayerData)
		{
			let assignBox = Engine.GetGUIObjectByName("playerAssignment["+i+"]");
			if (assignBox.list_data[assignBox.selected] == "local")
				playerID = +i+1;
		}

		Engine.StartGame(g_GameAttributes, playerID);
		Engine.SwitchGuiPage("page_loading.xml", {
			"attribs": g_GameAttributes,
			"isNetworked" : g_IsNetworked,
			"playerAssignments": g_PlayerAssignments
		});
	}
}

/**
 * Don't set any attributes here, just show the changes in the GUI.
 *
 * Unless the mapsettings don't specify a property and the user didn't set it in g_GameAttributes previously.
 */
function updateGUIObjects()
{
	g_IsInGuiUpdate = true;

	let mapSettings = g_GameAttributes.settings;

	// These dropdowns don't set values while g_IsInGuiUpdate
	let mapName = g_GameAttributes.map || "";
	let mapFilterIdx = g_MapFilters.findIndex(mapFilter => mapFilter.id == (g_GameAttributes.mapFilter || "default"));
	let mapTypeIdx = g_GameAttributes.mapType !== undefined ? g_MapTypes.Name.indexOf(g_GameAttributes.mapType) : g_MapTypes.Default;
	let gameSpeedIdx = g_GameAttributes.gameSpeed !== undefined ? g_GameSpeeds.Speed.indexOf(g_GameAttributes.gameSpeed) : g_GameSpeeds.Default;

	// These dropdowns might set the default (as they ignore g_IsInGuiUpdate)
	let mapSizeIdx = mapSettings.Size !== undefined ? g_MapSizes.Tiles.indexOf(mapSettings.Size) : g_MapSizes.Default;
	let victoryIdx = mapSettings.GameType !== undefined ? g_VictoryConditions.Name.indexOf(mapSettings.GameType) : g_VictoryConditions.Default;
	let popIdx = mapSettings.PopulationCap !== undefined ? g_PopulationCapacities.Population.indexOf(mapSettings.PopulationCap) : g_PopulationCapacities.Default;
	let startingResIdx = mapSettings.StartingResources !== undefined ? g_StartingResources.Resources.indexOf(mapSettings.StartingResources) : g_StartingResources.Default;
	let ceasefireIdx = mapSettings.Ceasefire !== undefined ? g_Ceasefire.Duration.indexOf(mapSettings.Ceasefire) : g_Ceasefire.Default;
	let numPlayers = mapSettings.PlayerData ? mapSettings.PlayerData.length : g_MaxPlayers;

	if (g_IsController)
	{
		Engine.GetGUIObjectByName("mapTypeSelection").selected = mapTypeIdx;
		Engine.GetGUIObjectByName("mapFilterSelection").selected = mapFilterIdx;
		Engine.GetGUIObjectByName("mapSelection").selected = Engine.GetGUIObjectByName("mapSelection").list_data.indexOf(mapName);
		Engine.GetGUIObjectByName("mapSize").selected = mapSizeIdx;
		Engine.GetGUIObjectByName("numPlayersSelection").selected = numPlayers - 1;
		Engine.GetGUIObjectByName("victoryCondition").selected = victoryIdx;
		Engine.GetGUIObjectByName("populationCap").selected = popIdx;
		Engine.GetGUIObjectByName("gameSpeed").selected = gameSpeedIdx;
		Engine.GetGUIObjectByName("ceasefire").selected = ceasefireIdx;
		Engine.GetGUIObjectByName("startingResources").selected = startingResIdx;
	}
	else
	{
		Engine.GetGUIObjectByName("mapTypeText").caption = g_MapTypes.Title[mapTypeIdx];
		Engine.GetGUIObjectByName("mapFilterText").caption = g_MapFilters[mapFilterIdx].name;
		Engine.GetGUIObjectByName("mapSelectionText").caption = mapName == "random" ? g_RandomMap : translate(getMapDisplayName(mapName));
		initMapNameList();
	}

	// Can be visible to both host and clients
	Engine.GetGUIObjectByName("mapSizeText").caption = g_GameAttributes.mapType == "random" ? g_MapSizes.LongName[mapSizeIdx] : translate("Default");
	Engine.GetGUIObjectByName("numPlayersText").caption = numPlayers;
	Engine.GetGUIObjectByName("victoryConditionText").caption = g_VictoryConditions.Title[victoryIdx];
	Engine.GetGUIObjectByName("populationCapText").caption = g_PopulationCapacities.Title[popIdx];
	Engine.GetGUIObjectByName("startingResourcesText").caption = g_StartingResources.Title[startingResIdx];
	Engine.GetGUIObjectByName("ceasefireText").caption = g_Ceasefire.Title[ceasefireIdx];
	Engine.GetGUIObjectByName("gameSpeedText").caption = g_GameSpeeds.Title[gameSpeedIdx];

	setGUIBoolean("enableCheats", "enableCheatsText", !!mapSettings.CheatsEnabled);
	setGUIBoolean("disableTreasures", "disableTreasuresText", !!mapSettings.DisableTreasures);
	setGUIBoolean("exploreMap", "exploreMapText", !!mapSettings.ExploreMap);
	setGUIBoolean("revealMap", "revealMapText", !!mapSettings.RevealMap);
	setGUIBoolean("lockTeams", "lockTeamsText", !!mapSettings.LockTeams);
	setGUIBoolean("observerLateJoin", "observerLateJoinText", !!mapSettings.ObserverLateJoin);
	setGUIBoolean("enableRating", "enableRatingText", !!mapSettings.RatingEnabled);

	Engine.GetGUIObjectByName("cheatWarningText").hidden = !g_IsNetworked || !mapSettings.CheatsEnabled;

	Engine.GetGUIObjectByName("enableCheats").enabled = !mapSettings.RatingEnabled;
	Engine.GetGUIObjectByName("lockTeams").enabled = !mapSettings.RatingEnabled;

	// Mapsize completely hidden for non-random maps
	let isRandom = g_GameAttributes.mapType == "random";
	Engine.GetGUIObjectByName("mapSizeDesc").hidden = !isRandom;
	Engine.GetGUIObjectByName("mapSize").hidden = !isRandom || !g_IsController;
	Engine.GetGUIObjectByName("mapSizeText").hidden = !isRandom || g_IsController;
	hideControl("numPlayersSelection", "numPlayersText", isRandom && g_IsController);

	let notScenario = g_GameAttributes.mapType != "scenario" && g_IsController ;
	hideControl("victoryCondition", "victoryConditionText", notScenario);
	hideControl("populationCap", "populationCapText", notScenario);
	hideControl("startingResources", "startingResourcesText", notScenario);
	hideControl("ceasefire", "ceasefireText", notScenario);
	hideControl("revealMap", "revealMapText", notScenario);
	hideControl("exploreMap", "exploreMapText", notScenario);
	hideControl("disableTreasures", "disableTreasuresText", notScenario);
	hideControl("lockTeams", "lockTeamsText", notScenario);

	setMapDescription();

	for (let i = 0; i < g_MaxPlayers; ++i)
	{
		Engine.GetGUIObjectByName("playerBox["+i+"]").hidden = (i >= numPlayers);

		if (i >= numPlayers)
			continue;

		let pName = Engine.GetGUIObjectByName("playerName["+i+"]");
		let pAssignment = Engine.GetGUIObjectByName("playerAssignment["+i+"]");
		let pAssignmentText = Engine.GetGUIObjectByName("playerAssignmentText["+i+"]");
		let pCiv = Engine.GetGUIObjectByName("playerCiv["+i+"]");
		let pCivText = Engine.GetGUIObjectByName("playerCivText["+i+"]");
		let pTeam = Engine.GetGUIObjectByName("playerTeam["+i+"]");
		let pTeamText = Engine.GetGUIObjectByName("playerTeamText["+i+"]");
		let pColor = Engine.GetGUIObjectByName("playerColor["+i+"]");

		let pData = mapSettings.PlayerData ? mapSettings.PlayerData[i] : {};
		let pDefs = g_DefaultPlayerData ? g_DefaultPlayerData[i] : {};

		let color = getSetting(pData, pDefs, "Color");
		pColor.sprite = "color:" + rgbToGuiColor(color) + " 100";
		pName.caption = translate(getSetting(pData, pDefs, "Name"));

		let team = getSetting(pData, pDefs, "Team");
		let civ = getSetting(pData, pDefs, "Civ");

		pAssignmentText.caption = pAssignment.list[0] ? pAssignment.list[Math.max(0, pAssignment.selected)] : translate("Loading...");
		pCivText.caption = civ == "random" ? g_RandomCiv : (g_CivData[civ] ? g_CivData[civ].Name : "Unknown");
		pTeamText.caption = (team !== undefined && team >= 0) ? team+1 : "-";

		pCiv.selected = civ ? pCiv.list_data.indexOf(civ) : 0;
		pTeam.selected = team !== undefined && team >= 0 ? team+1 : 0;

		hideControl("playerAssignment["+i+"]", "playerAssignmentText["+i+"]", g_IsController);
		hideControl("playerCiv["+i+"]", "playerCivText["+i+"]", notScenario);
		hideControl("playerTeam["+i+"]", "playerTeamText["+i+"]", notScenario);

		// Allow host to chose player colors on non-scenario maps
		let pColorPicker = Engine.GetGUIObjectByName("playerColorPicker["+i+"]");
		let pColorPickerHeading = Engine.GetGUIObjectByName("playerColorHeading");
		let canChangeColors = g_IsController && g_GameAttributes.mapType != "scenario";
		pColorPicker.hidden = !canChangeColors;
		pColorPickerHeading.hidden = !canChangeColors;
		if (canChangeColors)
			pColorPicker.selected = g_PlayerColors.findIndex(col => sameColor(col, color));
	}

	g_IsInGuiUpdate = false;

	// Game attributes include AI settings, so update the player list
	updatePlayerList();

	// We should have everyone confirm that the new settings are acceptable.
	resetReadyData();
}

/**
 * Sets an additional map label, map preview image and mapsettings description.
 */
function setMapDescription()
{
	let numPlayers = g_GameAttributes.settings.PlayerData ? g_GameAttributes.settings.PlayerData.length : 0;
	let mapName = g_GameAttributes.map || "";

	let victoryIdx = Math.max(0, g_VictoryConditions.Name.indexOf(g_GameAttributes.settings.GameType || ""));
	let victoryTitle = g_VictoryConditions.Title[victoryIdx];
	if (victoryIdx != g_VictoryConditions.Default)
		victoryTitle = "[color=\"" + g_VictoryColor + "\"]" + victoryTitle + "[/color]";

	let mapDescription = g_GameAttributes.settings.Description ? translate(g_GameAttributes.settings.Description) : translate("Sorry, no description available.");
	if (mapName == "random")
		mapDescription = translate("Randomly selects a map from the list");

	let gameDescription = sprintf(translatePlural("%(number)s player. ", "%(number)s players. ", numPlayers), { "number": numPlayers });
	gameDescription += translate("Victory Condition:") + " " + victoryTitle + ".\n\n";
	gameDescription += mapDescription;

	Engine.GetGUIObjectByName("mapInfoName").caption = mapName == "random" ? translateWithContext("map", "Random") : translate(getMapDisplayName(mapName));
	Engine.GetGUIObjectByName("mapInfoDescription").caption = gameDescription;
	setMapPreviewImage("mapPreview", getMapPreview(mapName));
}

/**
 * Broadcast the changed settings to all clients and the lobbybot.
 */
function updateGameAttributes()
{
	if (g_IsInGuiUpdate || !g_IsController)
		return;

	if (g_IsNetworked)
	{
		Engine.SetNetworkGameAttributes(g_GameAttributes);
		if (g_LoadingState >= 2)
			sendRegisterGameStanza();
	}
	else
		updateGUIObjects();
}

function AIConfigCallback(ai)
{
	g_GameAttributes.settings.PlayerData[ai.playerSlot].AI = ai.id;
	g_GameAttributes.settings.PlayerData[ai.playerSlot].AIDiff = ai.difficulty;

	if (g_IsNetworked)
		Engine.SetNetworkGameAttributes(g_GameAttributes);
	else
		updatePlayerList();
}

function updatePlayerList()
{
	g_IsInGuiUpdate = true;

	let hostNameList = [];
	let hostGuidList = [];
	let assignments = [];
	let aiAssignments = {};
	let noAssignment;
	let assignedCount = 0;

	for (let guid in g_PlayerAssignments)
	{
		let player = g_PlayerAssignments[guid].player;

		hostNameList.push(g_PlayerAssignments[guid].name);
		hostGuidList.push(guid);
		assignments[player] = hostNameList.length-1;

		if (player != -1)
			assignedCount++;
	}

	// Only enable start button if we have enough assigned players
	if (g_IsController)
		Engine.GetGUIObjectByName("startGame").enabled = assignedCount > 0;

	for (let ai of g_Settings.AIDescriptions)
	{
		// If the map uses a hidden AI then don't hide it
		if (ai.data.hidden && g_GameAttributes.settings.PlayerData.every(pData => pData.AI != ai.id))
			continue;

		aiAssignments[ai.id] = hostNameList.length;
		hostNameList.push("[color=\""+ g_AIColor + "\"]" + sprintf(translate("AI: %(ai)s"), { "ai": translate(ai.data.name) }));
		hostGuidList.push("ai:" + ai.id);
	}

	noAssignment = hostNameList.length;
	hostNameList.push("[color=\""+ g_UnassignedColor + "\"]" + translate("Unassigned"));
	hostGuidList.push("");

	for (let i = 0; i < g_MaxPlayers; ++i)
	{
		let playerSlot = i;
		let playerID = i+1; // we don't show Gaia, so first slot is ID 1

		let selection = assignments[playerID];

		let configButton = Engine.GetGUIObjectByName("playerConfig["+i+"]");
		configButton.hidden = true;

		// Look for valid player slots
		if (playerSlot >= g_GameAttributes.settings.PlayerData.length)
			continue;

		// If no human is assigned, look for an AI instead
		if (selection === undefined)
		{
			let aiId = g_GameAttributes.settings.PlayerData[playerSlot].AI;
			if (aiId)
			{
				// Check for a valid AI
				if (aiId in aiAssignments)
					selection = aiAssignments[aiId];
				else
				{
					g_GameAttributes.settings.PlayerData[playerSlot].AI = "";
					warn("AI \"" + aiId + "\" not present. Defaulting to unassigned.");
				}
			}

			if (!selection)
				selection = noAssignment;

			// Since no human is assigned, show the AI config button
			if (g_IsController)
			{
				configButton.hidden = false;
				configButton.onpress = function() {
					Engine.PushGuiPage("page_aiconfig.xml", {
						"id": g_GameAttributes.settings.PlayerData[playerSlot].AI,
						"difficulty": g_GameAttributes.settings.PlayerData[playerSlot].AIDiff,
						"callback": "AIConfigCallback",
						"playerSlot": playerSlot // required by the callback function
					});
				};
			}
		}
		// There was a human, so make sure we don't have any AI left
		// over in their slot, if we're in charge of the attributes
		else if (g_IsController && g_GameAttributes.settings.PlayerData[playerSlot].AI)
		{
			g_GameAttributes.settings.PlayerData[playerSlot].AI = "";
			if (g_IsNetworked)
				Engine.SetNetworkGameAttributes(g_GameAttributes);
		}

		let assignBox = Engine.GetGUIObjectByName("playerAssignment["+i+"]");
		let assignBoxText = Engine.GetGUIObjectByName("playerAssignmentText["+i+"]");
		assignBox.list = hostNameList;
		assignBox.list_data = hostGuidList;
		if (assignBox.selected != selection)
			assignBox.selected = selection;
		assignBoxText.caption = hostNameList[selection];

		if (g_IsController)
			assignBox.onselectionchange = function() {
				if (g_IsInGuiUpdate)
					return;

				let guid = hostGuidList[this.selected];
				if (!guid)
				{
					if (g_IsNetworked)
						// Unassign any host from this player slot
						Engine.AssignNetworkPlayer(playerID, "");
					// Remove AI from this player slot
					g_GameAttributes.settings.PlayerData[playerSlot].AI = "";
				}
				else if (guid.substr(0, 3) == "ai:")
				{
					if (g_IsNetworked)
						// Unassign any host from this player slot
						Engine.AssignNetworkPlayer(playerID, "");
					// Set the AI for this player slot
					g_GameAttributes.settings.PlayerData[playerSlot].AI = guid.substr(3);
				}
				else
					swapPlayers(guid, playerSlot);

				if (g_IsNetworked)
					Engine.SetNetworkGameAttributes(g_GameAttributes);
				else
					updatePlayerList();
				updateReadyUI();
			};
	}

	g_IsInGuiUpdate = false;
}

function swapPlayers(guid, newSlot)
{
	// Player slots are indexed from 0 as Gaia is omitted.
	let newPlayerID = newSlot + 1;
	let playerID = g_PlayerAssignments[guid].player;

	// Attempt to swap the player or AI occupying the target slot,
	// if any, into the slot this player is currently in.
	if (playerID != -1)
	{
		for (let guid in g_PlayerAssignments)
		{
			// Move the player in the destination slot into the current slot.
			if (g_PlayerAssignments[guid].player != newPlayerID)
				continue;

			if (g_IsNetworked)
				Engine.AssignNetworkPlayer(playerID, guid);
			else
				g_PlayerAssignments[guid].player = playerID;
			break;
		}

		// Transfer the AI from the target slot to the current slot.
		g_GameAttributes.settings.PlayerData[playerID - 1].AI = g_GameAttributes.settings.PlayerData[newSlot].AI;
	}

	if (g_IsNetworked)
		Engine.AssignNetworkPlayer(newPlayerID, guid);
	else
		g_PlayerAssignments[guid].player = newPlayerID;

	// Remove AI from this player slot
	g_GameAttributes.settings.PlayerData[newSlot].AI = "";
}

function submitChatInput()
{
	let input = Engine.GetGUIObjectByName("chatInput");
	let text = input.caption;
	if (!text.length)
		return;

	input.caption = "";

	if (executeNetworkCommand(text))
		return;

	Engine.SendNetworkChat(text);
}

function senderFont(text)
{
	return '[font="' + g_SenderFont + '"]' + text + '[/font]';
}

function systemMessage(message)
{
	return senderFont(sprintf(translate("== %(message)s"), { "message": message }));
}

function colorizePlayernameByGUID(guid, username = "")
{
	// TODO: Maybe the host should have the moderator-prefix?
	if (!username)
		username = g_PlayerAssignments[guid] ? escapeText(g_PlayerAssignments[guid].name) : translate("Unknown Player");
	let playerID = g_PlayerAssignments[guid] ? g_PlayerAssignments[guid].player : -1;

	let color = "white";
	if (playerID > 0)
	{
		color = g_GameAttributes.settings.PlayerData[playerID - 1].Color;

		// Enlighten playercolor to improve readability
		let [h, s, l] = rgbToHsl(color.r, color.g, color.b);
		let [r, g, b] = hslToRgb(h, s, Math.max(0.6, l));

		color = rgbToGuiColor({ "r": r, "g": g, "b": b });
	}

	return '[color="'+ color +'"]' + username + '[/color]';
}

function addChatMessage(msg)
{
	if (!g_FormatChatMessage[msg.type])
		return;

	let user = colorizePlayernameByGUID(msg.guid || -1, msg.username || "");

	g_ChatMessages.push(g_FormatChatMessage[msg.type](msg, user));

	Engine.GetGUIObjectByName("chatText").caption = g_ChatMessages.join("\n");
}

function showMoreOptions(show)
{
	Engine.GetGUIObjectByName("moreOptionsFade").hidden = !show;
	Engine.GetGUIObjectByName("moreOptions").hidden = !show;
}

function toggleReady()
{
	g_IsReady = !g_IsReady;
	if (g_IsReady)
	{
		Engine.SendNetworkReady(1);
		Engine.GetGUIObjectByName("startGame").caption = translate("I'm not ready");
		Engine.GetGUIObjectByName("startGame").tooltip = translate("State that you are not ready to play.");
	}
	else
	{
		Engine.SendNetworkReady(0);
		Engine.GetGUIObjectByName("startGame").caption = translate("I'm ready!");
		Engine.GetGUIObjectByName("startGame").tooltip = translate("State that you are ready to play!");
	}
}

function updateReadyUI()
{
	if (!g_IsNetworked)
		return;

	let isAI = new Array(g_MaxPlayers + 1).fill(true);
	let allReady = true;
	for (let guid in g_PlayerAssignments)
	{
		// We don't really care whether observers are ready.
		if (g_PlayerAssignments[guid].player == -1 || !g_GameAttributes.settings.PlayerData[g_PlayerAssignments[guid].player - 1])
			continue;
		let pData = g_GameAttributes.settings.PlayerData ? g_GameAttributes.settings.PlayerData[g_PlayerAssignments[guid].player - 1] : {};
		let pDefs = g_DefaultPlayerData ? g_DefaultPlayerData[g_PlayerAssignments[guid].player - 1] : {};
		isAI[g_PlayerAssignments[guid].player] = false;
		if (g_PlayerAssignments[guid].status || !g_IsNetworked)
			Engine.GetGUIObjectByName("playerName[" + (g_PlayerAssignments[guid].player - 1) + "]").caption = '[color="' + g_ReadyColor + '"]' + translate(getSetting(pData, pDefs, "Name")) + '[/color]';
		else
		{
			Engine.GetGUIObjectByName("playerName[" + (g_PlayerAssignments[guid].player - 1) + "]").caption = translate(getSetting(pData, pDefs, "Name"));
			allReady = false;
		}
	}

	// AIs are always ready.
	for (let playerid = 0; playerid < g_MaxPlayers; ++playerid)
	{
		if (!g_GameAttributes.settings.PlayerData[playerid])
			continue;
		let pData = g_GameAttributes.settings.PlayerData ? g_GameAttributes.settings.PlayerData[playerid] : {};
		let pDefs = g_DefaultPlayerData ? g_DefaultPlayerData[playerid] : {};
		if (isAI[playerid + 1])
			Engine.GetGUIObjectByName("playerName[" + playerid + "]").caption = '[color="' + g_ReadyColor + '"]' + translate(getSetting(pData, pDefs, "Name")) + '[/color]';
	}

	// The host is not allowed to start until everyone is ready.
	if (g_IsNetworked && g_IsController)
	{
		let startGameButton = Engine.GetGUIObjectByName("startGame");
		startGameButton.enabled = allReady;
		// Add a explanation on to the tooltip if disabled.
		let disabledIndex = startGameButton.tooltip.indexOf('Disabled');
		if (disabledIndex != -1 && allReady)
			startGameButton.tooltip = startGameButton.tooltip.substring(0, disabledIndex - 2);
		else if (disabledIndex == -1 && !allReady)
			startGameButton.tooltip = startGameButton.tooltip + " (Disabled until all players are ready)";
	}
}

function resetReadyData()
{
	if (g_GameStarted)
		return;

	if (g_ReadyChanged < 1)
		addChatMessage({ "type": "settings" });
	else if (g_ReadyChanged == 2 && !g_ReadyInit)
		return; // duplicate calls on init
	else
		g_ReadyInit = false;

	g_ReadyChanged = 2;
	if (!g_IsNetworked)
		g_IsReady = true;
	else if (g_IsController)
	{
		Engine.ClearAllPlayerReady();
		g_IsReady = true;
		Engine.SendNetworkReady(1);
	}
	else
	{
		g_IsReady = false;
		Engine.GetGUIObjectByName("startGame").caption = translate("I'm ready!");
		Engine.GetGUIObjectByName("startGame").tooltip = translate("State that you accept the current settings and are ready to play!");
	}
}

/**
 * Send the relevant gamesettings to the lobbybot.
 */
function sendRegisterGameStanza()
{
	if (!g_IsController || !Engine.HasXmppClient())
		return;

	let selectedMapSize = Engine.GetGUIObjectByName("mapSize").selected;
	let selectedVictoryCondition = Engine.GetGUIObjectByName("victoryCondition").selected;

	let mapSize = g_GameAttributes.mapType == "random" ? Engine.GetGUIObjectByName("mapSize").list_data[selectedMapSize] : "Default";
	let victoryCondition = Engine.GetGUIObjectByName("victoryCondition").list[selectedVictoryCondition];
	let playerNames = Object.keys(g_PlayerAssignments).map(guid => g_PlayerAssignments[guid].name);

	Engine.SendRegisterGame({
		"name": g_ServerName,
		"mapName": g_GameAttributes.map,
		"niceMapName": getMapDisplayName(g_GameAttributes.map),
		"mapSize": mapSize,
		"mapType": g_GameAttributes.mapType,
		"victoryCondition": victoryCondition,
		"nbp": Object.keys(g_PlayerAssignments).length || 1,
		"tnbp": g_GameAttributes.settings.PlayerData.length,
		"players": playerNames.join(", ")
	});
}
