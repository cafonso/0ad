var g_PlayerSlot;

const g_AIDescriptions = [{
	"id": "",
	"data": {
		"name": translateWithContext("ai", "None"),
		"description": translate("AI will be disabled for this player.")
	}
}].concat(g_Settings.AIDescriptions);

function init(settings)
{
	// Remember the player ID that we change the AI settings for
	g_PlayerSlot = settings.playerSlot;

	var aiSelection = Engine.GetGUIObjectByName("aiSelection");
	aiSelection.list = g_AIDescriptions.map(ai => ai.data.name);
	aiSelection.selected = g_AIDescriptions.findIndex(ai => ai.id == settings.id);

	var aiDiff = Engine.GetGUIObjectByName("aiDifficulty");
	aiDiff.list = prepareForDropdown(g_Settings.AIDifficulties).Title;
	aiDiff.selected = settings.difficulty;
}

function selectAI(idx)
{
	Engine.GetGUIObjectByName("aiDescription").caption = g_AIDescriptions[idx].data.description;
}

function returnAI()
{
	var idx = Engine.GetGUIObjectByName("aiSelection").selected;

	// Pop the page before calling the callback, so the callback runs
	// in the parent GUI page's context
	Engine.PopGuiPageCB({
		"id": g_AIDescriptions[idx].id,
		"name": g_AIDescriptions[idx].data.name,
		"difficulty": Engine.GetGUIObjectByName("aiDifficulty").selected,
		"playerSlot": g_PlayerSlot
	});
}
