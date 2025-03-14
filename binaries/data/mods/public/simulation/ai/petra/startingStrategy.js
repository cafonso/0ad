var PETRA = function(m)
{
/**
 * determines the strategy to adopt when starting a new game, depending on the initial conditions
 */

m.HQ.prototype.gameAnalysis = function(gameState)
{
	// Analysis of the terrain and the different access regions
	if (!this.regionAnalysis(gameState))
		return;

	this.attackManager.init(gameState);
	this.navalManager.init(gameState);
	this.tradeManager.init(gameState);

	// Make a list of buildable structures from the config file
	this.structureAnalysis(gameState);

	// Let's get our initial situation here.
	let nobase = new m.BaseManager(gameState, this.Config);
	nobase.init(gameState);
	nobase.accessIndex = 0;
	this.baseManagers.push(nobase);   // baseManagers[0] will deal with unit/structure without base
	var ccEnts = gameState.getOwnStructures().filter(API3.Filters.byClass("CivCentre"));
	for (let cc of ccEnts.values())
	{
		let newbase = new m.BaseManager(gameState, this.Config);
		newbase.init(gameState);
		newbase.setAnchor(gameState, cc);
		this.baseManagers.push(newbase);
	}
	this.updateTerritories(gameState);

	// Assign entities and resources in the different bases
	this.assignStartingEntities(gameState);

	// If no base yet, check if we can construct one. If not, dispatch our units to possible tasks/attacks
	this.canBuildUnits = true;
	if (!gameState.getOwnStructures().filter(API3.Filters.byClass("CivCentre")).length)
	{
		let template = gameState.applyCiv("structures/{civ}_civil_centre");
		if (gameState.isDisabledTemplates(template) || !gameState.getTemplate(template).available(gameState))
		{
			if (this.Config.debug > 1)
				API3.warn(" this AI is unable to produce any units");
			this.canBuildUnits = false;
			this.dispatchUnits(gameState);
		}
		else
			this.buildFirstBase(gameState);
	}

	// configure our first base strategy
	if (this.baseManagers.length > 1)
		this.configFirstBase(gameState);
};

/**
 * Assign the starting entities to the different bases
 */
m.HQ.prototype.assignStartingEntities = function(gameState)
{
	for (var ent of gameState.getOwnEntities().values())
	{
		// do not affect merchant ship immediately to trade as they may-be useful for transport
		if (ent.hasClass("Trader") && !ent.hasClass("Ship"))
			this.tradeManager.assignTrader(ent);

		var pos = ent.position();
		if (!pos)
		{
			// TODO should support recursive garrisoning. Make a warning for now
			if (ent.isGarrisonHolder() && ent.garrisoned().length)
				API3.warn("Petra warning: support for garrisoned units inside garrisoned holders not yet implemented");
			continue;
		}

		// make sure we have not rejected small regions with units (TODO should probably also check with other non-gaia units)
		let gamepos = gameState.ai.accessibility.gamePosToMapPos(pos);
		let index = gamepos[0] + gamepos[1]*gameState.ai.accessibility.width;
		let land = gameState.ai.accessibility.landPassMap[index];
		if (land > 1 && !this.landRegions[land])
			this.landRegions[land] = true;
		let sea = gameState.ai.accessibility.navalPassMap[index];
		if (sea > 1 && !this.navalRegions[sea])
			this.navalRegions[sea] = true;

		// if garrisoned units inside, ungarrison them except if a ship in which case we will make a transport 
		// when a construction will start (see createTransportIfNeeded)
		if (ent.isGarrisonHolder() && ent.garrisoned().length && !ent.hasClass("Ship"))
			for (let id of ent.garrisoned())
				ent.unload(id);

		ent.setMetadata(PlayerID, "access", gameState.ai.accessibility.getAccessValue(pos));
		let bestbase;
		var territorypos = this.territoryMap.gamePosToMapPos(pos);
		var territoryIndex = territorypos[0] + territorypos[1]*this.territoryMap.width;
		for (let i = 1; i < this.baseManagers.length; ++i)
		{
			let base = this.baseManagers[i];
			if (base.territoryIndices.indexOf(territoryIndex) === -1)
				continue;
			base.assignEntity(gameState, ent);
			bestbase = base;
			break;
		}
		if (!bestbase)	// entity outside our territory
		{
			bestbase = m.getBestBase(gameState, ent);
			bestbase.assignEntity(gameState, ent);
		}
		// now assign entities garrisoned inside this entity
		if (ent.isGarrisonHolder() && ent.garrisoned().length)
			for (let id of ent.garrisoned())
				bestbase.assignEntity(gameState, gameState.getEntityById(id));
		// and find something useful to do if we already have a base
		if (pos && bestbase.ID !== this.baseManagers[0].ID)
		{
			bestbase.assignRolelessUnits(gameState, [ent]);
			if (ent.getMetadata(PlayerID, "role") === "worker")
			{
				bestbase.reassignIdleWorkers(gameState, [ent]);
				bestbase.workerObject.update(gameState, ent);
			}
		}
	}
};

/**
 * determine the main land Index (or water index if none)
 * as well as the list of allowed (land andf water) regions
 */
m.HQ.prototype.regionAnalysis = function(gameState)
{
	var accessibility = gameState.ai.accessibility;
	let landIndex;
	let seaIndex;
	var ccEnts = gameState.getOwnStructures().filter(API3.Filters.byClass("CivCentre"));
	for (let cc of ccEnts.values())
	{
		let land = accessibility.getAccessValue(cc.position());
		if (land > 1)
		{
			landIndex = land;
			break;
		}
	}
	if (!landIndex)
	{
		var civ = gameState.civ();
		for (let ent of gameState.getOwnEntities().values())
		{
			if (!ent.position() || (!ent.hasClass("Unit") && !ent.trainableEntities(civ)))
				continue;
			let land = accessibility.getAccessValue(ent.position());
			if (land > 1)
			{
				landIndex = land;
				break;
			}
			let sea = accessibility.getAccessValue(ent.position(), true);
			if (!seaIndex && sea > 1)
				seaIndex = sea;
		}
	}
	if (!landIndex && !seaIndex)
	{
		API3.warn("Petra error: it does not know how to interpret this map");
		return false;
	}

	var passabilityMap = gameState.getMap();
	var totalSize = passabilityMap.width * passabilityMap.width;
	var minLandSize = Math.floor(0.1*totalSize);
	var minWaterSize = Math.floor(0.2*totalSize);
	var cellArea = passabilityMap.cellSize * passabilityMap.cellSize;  
	for (let i = 0; i < accessibility.regionSize.length; ++i)
	{
		if (landIndex && i == landIndex)
			this.landRegions[i] = true;
		else if (accessibility.regionType[i] === "land" && cellArea*accessibility.regionSize[i] > 320)
		{
			if (landIndex)
			{
				let sea = this.getSeaIndex(gameState, landIndex, i);
				if (sea && (accessibility.regionSize[i] > minLandSize || accessibility.regionSize[sea] > minWaterSize))
				{
					this.navalMap = true;
					this.landRegions[i] = true;
					this.navalRegions[sea] = true;
				}
			}
			else
			{
				let traject = accessibility.getTrajectToIndex(seaIndex, i);
				if (traject && traject.length === 2)
				{
					this.navalMap = true;
					this.landRegions[i] = true;
					this.navalRegions[seaIndex] = true;
				}
			}
		}
		else if (accessibility.regionType[i] === "water" && accessibility.regionSize[i] > minWaterSize)
		{
			this.navalMap = true;
			this.navalRegions[i] = true;
		}
		else if (accessibility.regionType[i] === "water" && cellArea*accessibility.regionSize[i] > 3600)
			this.navalRegions[i] = true;
	}

	if (this.Config.debug < 3)
		return true;
	for (let region in this.landRegions)
		API3.warn(" >>> zone " + region + " taille " + cellArea*gameState.ai.accessibility.regionSize[region]);
	API3.warn(" navalMap " + this.navalMap);
	API3.warn(" landRegions " + uneval(this.landRegions));
	API3.warn(" navalRegions " + uneval(this.navalRegions));
	return true;
};

/**
 * load units and buildings from the config files
 * TODO: change that to something dynamic
 */
m.HQ.prototype.structureAnalysis = function(gameState)
{
	var civ = gameState.playerData.civ;
	if (civ in this.Config.buildings.base)
		this.bBase = this.Config.buildings.base[civ];
	else
		this.bBase = this.Config.buildings.base['default'];

	if (civ in this.Config.buildings.advanced)
		this.bAdvanced = this.Config.buildings.advanced[civ];
	else
		this.bAdvanced = this.Config.buildings.advanced['default'];	
	for (let i in this.bBase)
		this.bBase[i] = gameState.applyCiv(this.bBase[i]);
	for (let i in this.bAdvanced)
		this.bAdvanced[i] = gameState.applyCiv(this.bAdvanced[i]);
};

/**
 * build our first base
 * if not enough resource, try first to do a dock
 */
m.HQ.prototype.buildFirstBase = function(gameState)
{
	var total = gameState.getResources();
	var template = gameState.applyCiv("structures/{civ}_civil_centre");
	if (gameState.isDisabledTemplates(template))
		return;
	var template = gameState.getTemplate(template);
	var goal = "civil_centre";
	var docks = gameState.getOwnStructures().filter(API3.Filters.byClass("Dock"));
	if (!total.canAfford(new API3.Resources(template.cost())) && !docks.length)
	{
		// not enough resource to build a cc, try with a dock to accumulate resources if none yet
		if (gameState.ai.queues.dock.countQueuedUnits())
			return;
		template = gameState.applyCiv("structures/{civ}_dock");
		if (gameState.isDisabledTemplates(template))
			return;
		template = gameState.getTemplate(template);
		if (!total.canAfford(new API3.Resources(template.cost())))
			return;
		goal = "dock";
	}

	// We first choose as startingPoint the point where we have the more units  
	let startingPoint = [];
	for (let ent of gameState.getOwnUnits().values())
	{
		if (!ent.hasClass("Worker") && !(ent.hasClass("Support") && ent.hasClass("Elephant")))
			continue;
		if (ent.hasClass("Cavalry"))
			continue;
		let pos = ent.position();
		if (!pos)
		{
			let holder = m.getHolder(gameState, ent);
			if (!holder || !holder.position())
				continue;
			pos = holder.position();
		}
		let gamepos = gameState.ai.accessibility.gamePosToMapPos(pos);
		let index = gamepos[0] + gamepos[1]*gameState.ai.accessibility.width;
		let land = gameState.ai.accessibility.landPassMap[index];
		let sea = gameState.ai.accessibility.navalPassMap[index];
		let found = false;
		for (let point of startingPoint)
		{
			if (land !== point.land || sea !== point.sea)
				continue;
			if (API3.SquareVectorDistance(point.pos, pos) > 2500)
				continue;
			point.weight += 1;
			found = true;
			break;
		}
		if (!found)
			startingPoint.push({"pos": pos, "land": land, "sea": sea, "weight": 1});
	}
	if (!startingPoint.length)
		return;

	let imax = 0;
	for (let i = 1; i < startingPoint.length; ++i)
		if (startingPoint[i].weight > startingPoint[imax].weight)
			imax = i;

	if (goal === "dock")
	{
		let sea = startingPoint[imax].sea > 1 ? startingPoint[imax].sea : undefined;
		gameState.ai.queues.dock.addPlan(new m.ConstructionPlan(gameState, "structures/{civ}_dock", { "sea": sea, "proximity": startingPoint[imax].pos }));
	}
	else
		gameState.ai.queues.civilCentre.addPlan(new m.ConstructionPlan(gameState, "structures/{civ}_civil_centre", { "base": -1, "resource": "wood", "proximity": startingPoint[imax].pos }));
};

/**
 * set strategy if game without construction:
 *   - if one of our allies has a cc, affect a small fraction of our army for his defense, the rest will attack
 *   - otherwise all units will attack
 */
m.HQ.prototype.dispatchUnits = function(gameState)
{
	var allycc = gameState.getExclusiveAllyEntities().filter(API3.Filters.byClass("CivCentre")).toEntityArray();
	if (allycc.length)
	{
		if (this.Config.debug > 1)
			API3.warn(" We have allied cc " + allycc.length + " and " + gameState.getOwnUnits().length + " units ");
		var units = gameState.getOwnUnits();
		var num = Math.max(Math.min(Math.round(0.08*(1+this.Config.personality.cooperative)*units.length), 20), 5);
		var num1 = Math.floor(num / 2);
		var num2 = num1;
		// first pass to affect ranged infantry
		units.filter(API3.Filters.byClassesAnd(["Infantry", "Ranged"])).forEach(function (ent) {
			if (!num || !num1)
				return;
			if (ent.getMetadata(PlayerID, "allied"))
				return;
			var access = gameState.ai.accessibility.getAccessValue(ent.position());
			for (let cc of allycc)
			{
				if (!cc.position())
					continue;
				if (gameState.ai.accessibility.getAccessValue(cc.position()) != access)
					continue;
				--num;
				--num1;
				ent.setMetadata(PlayerID, "allied", true);
				let range = 1.5 * cc.footprintRadius();
				ent.moveToRange(cc.position()[0], cc.position()[1], range, range);
				break;
			}
		});
		// second pass to affect melee infantry
		units.filter(API3.Filters.byClassesAnd(["Infantry", "Melee"])).forEach(function (ent) {
			if (!num || !num2)
				return;
			if (ent.getMetadata(PlayerID, "allied"))
				return;
			var access = gameState.ai.accessibility.getAccessValue(ent.position());
			for (let cc of allycc)
			{
				if (!cc.position())
					continue;
				if (gameState.ai.accessibility.getAccessValue(cc.position()) != access)
					continue;
				--num;
				--num2;
				ent.setMetadata(PlayerID, "allied", true);
				let range = 1.5 * cc.footprintRadius();
				ent.moveToRange(cc.position()[0], cc.position()[1], range, range);
				break;
			}
		});
		// and now complete the affectation, including all support units
		units.forEach(function (ent) {
			if (!num && !ent.hasClass("Support"))
				return;
			if (ent.getMetadata(PlayerID, "allied"))
				return;
			var access = gameState.ai.accessibility.getAccessValue(ent.position());
			for (let cc of allycc)
			{
				if (!cc.position())
					continue;
				if (gameState.ai.accessibility.getAccessValue(cc.position()) != access)
					continue;
				if (!ent.hasClass("Support"))
					--num;
				ent.setMetadata(PlayerID, "allied", true);
				let range = 1.5 * cc.footprintRadius();
				ent.moveToRange(cc.position()[0], cc.position()[1], range, range);
				break;
			}
		});
	}
};

/**
 * configure our first base expansion
 *   - if on a small island, favor fishing
 *   - count the available wood resource, and allow rushes only if enough (we should otherwise favor expansion)
 */
m.HQ.prototype.configFirstBase = function(gameState)
{
	if (this.baseManagers.length < 2)
		return;

	var startingSize = 0;
	for (let region in this.landRegions)
	{
		for (let base of this.baseManagers)
		{
			if (!base.anchor || base.accessIndex != +region)
				continue;
			startingSize += gameState.ai.accessibility.regionSize[region];
			break;
		}
	}
	var cell = gameState.getMap().cellSize;
	startingSize = startingSize * cell * cell;
	if (this.Config.debug > 1)
		API3.warn("starting size " + startingSize + "(cut at 24000 for fish pushing)");
	if (startingSize < 24000)
	{
		this.saveSpace = true;
		this.Config.Economy.popForDock = Math.min(this.Config.Economy.popForDock, 16);
		this.Config.Economy.targetNumFishers = Math.max(this.Config.Economy.targetNumFishers, 2);
	}

	// - count the available wood resource, and allow rushes only if enough (we should otherwise favor expansion)
	var startingWood = gameState.getResources()["wood"];
	var check = {};
	for (let proxim of ["nearby", "medium", "faraway"])
	{
		for (let base of this.baseManagers)
		{
			for (let supply of base.dropsiteSupplies["wood"][proxim])
			{
				if (check[supply.id])    // avoid double counting as same resource can appear several time
					continue;
				check[supply.id] = true;
				startingWood += supply.ent.resourceSupplyAmount();
			}
		}
	}
	if (this.Config.debug > 1)
		API3.warn("startingWood: " + startingWood + " (cut at 8500 for no rush and 6000 for saveResources)");
	if (startingWood < 6000)
		this.saveResources = true;
	if (startingWood > 8500 && this.canBuildUnits)
	{
		let allowed = Math.ceil((startingWood - 8500) / 3000);
		this.attackManager.setRushes(allowed);
	}

	// immediatly build a wood dropsite if possible.
	var template = gameState.applyCiv("structures/{civ}_storehouse");
	if (gameState.getOwnEntitiesByClass("Storehouse", true).length === 0 && this.canBuild(gameState, template))
	{
		let newDP = this.baseManagers[1].findBestDropsiteLocation(gameState, "wood");
		if (newDP.quality > 40)
		{
			// if we start with enough workers, put our available resources in this first dropsite
			// same thing if our pop exceed the allowed one, as we will need several houses
			let numWorkers = gameState.getOwnUnits().filter(API3.Filters.byClass("Worker")).length;
			if ((numWorkers > 12 && newDP.quality > 60)
				|| (gameState.getPopulation() > gameState.getPopulationLimit() + 20))
			{
				let cost = new API3.Resources(gameState.getTemplate(template).cost());
				gameState.ai.queueManager.setAccounts(gameState, cost, "dropsites");
			}
			gameState.ai.queues.dropsites.addPlan(new m.ConstructionPlan(gameState, template, { "base": this.baseManagers[1].ID }, newDP.pos));
		}
	}
};

return m;

}(PETRA);
