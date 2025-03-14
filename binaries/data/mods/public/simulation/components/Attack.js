function Attack() {}

Attack.prototype.bonusesSchema = 
	"<optional>" +
		"<element name='Bonuses'>" +
			"<zeroOrMore>" +
				"<element>" +
					"<anyName/>" +
					"<interleave>" +
						"<optional>" +
							"<element name='Civ' a:help='If an entity has this civ then the bonus is applied'><text/></element>" +
						"</optional>" +
						"<element name='Classes' a:help='If an entity has all these classes then the bonus is applied'><text/></element>" +
						"<element name='Multiplier' a:help='The attackers attack strength is multiplied by this'><ref name='nonNegativeDecimal'/></element>" +
					"</interleave>" +
				"</element>" +
			"</zeroOrMore>" +
		"</element>" +
	"</optional>";

Attack.prototype.preferredClassesSchema =
	"<optional>" +
		"<element name='PreferredClasses' a:help='Space delimited list of classes preferred for attacking. If an entity has any of theses classes, it is preferred. The classes are in decending order of preference'>" +
			"<attribute name='datatype'>" +
				"<value>tokens</value>" +
			"</attribute>" +
			"<text/>" +
		"</element>" +
	"</optional>";

Attack.prototype.restrictedClassesSchema =
	"<optional>" +
		"<element name='RestrictedClasses' a:help='Space delimited list of classes that cannot be attacked by this entity. If target entity has any of these classes, it cannot be attacked'>" +
			"<attribute name='datatype'>" +
				"<value>tokens</value>" +
			"</attribute>" +
			"<text/>" +
		"</element>" +
	"</optional>";

Attack.prototype.Schema =
	"<a:help>Controls the attack abilities and strengths of the unit.</a:help>" +
	"<a:example>" +
		"<Melee>" +
			"<Hack>10.0</Hack>" +
			"<Pierce>0.0</Pierce>" +
			"<Crush>5.0</Crush>" +
			"<MaxRange>4.0</MaxRange>" +
			"<RepeatTime>1000</RepeatTime>" +
			"<Bonuses>" +
				"<Bonus1>" +
					"<Civ>pers</Civ>" +
					"<Classes>Infantry</Classes>" +
					"<Multiplier>1.5</Multiplier>" +
				"</Bonus1>" +
				"<BonusCavMelee>" +
					"<Classes>Cavalry Melee</Classes>" +
					"<Multiplier>1.5</Multiplier>" +
				"</BonusCavMelee>" +
			"</Bonuses>" +
			"<RestrictedClasses datatype=\"tokens\">Champion</RestrictedClasses>" +
			"<PreferredClasses datatype=\"tokens\">Cavalry Infantry</PreferredClasses>" +
		"</Melee>" +
		"<Ranged>" +
			"<Hack>0.0</Hack>" +
			"<Pierce>10.0</Pierce>" +
			"<Crush>0.0</Crush>" +
			"<MaxRange>44.0</MaxRange>" +
			"<MinRange>20.0</MinRange>" +
			"<ElevationBonus>15.0</ElevationBonus>" +
			"<PrepareTime>800</PrepareTime>" +
			"<RepeatTime>1600</RepeatTime>" +
			"<ProjectileSpeed>50.0</ProjectileSpeed>" +
			"<Spread>2.5</Spread>" +
			"<Bonuses>" +
				"<Bonus1>" +
					"<Classes>Cavalry</Classes>" +
					"<Multiplier>2</Multiplier>" +
				"</Bonus1>" +
			"</Bonuses>" +
			"<RestrictedClasses datatype=\"tokens\">Champion</RestrictedClasses>" +
			"<Splash>" +
				"<Shape>Circular</Shape>" +
				"<Range>20</Range>" +
				"<FriendlyFire>false</FriendlyFire>" +
				"<Hack>0.0</Hack>" +
				"<Pierce>10.0</Pierce>" +
				"<Crush>0.0</Crush>" +
			"</Splash>" +
		"</Ranged>" +
		"<Charge>" +
			"<Hack>10.0</Hack>" +
			"<Pierce>0.0</Pierce>" +
			"<Crush>50.0</Crush>" +
			"<MaxRange>24.0</MaxRange>" +
			"<MinRange>20.0</MinRange>" +
		"</Charge>" +
		"<Slaughter>" +
			"<Hack>1000.0</Hack>" +
			"<Pierce>0.0</Pierce>" +
			"<Crush>0.0</Crush>" +
			"<MaxRange>4.0</MaxRange>" +
		"</Slaughter>" +
	"</a:example>" +
	"<optional>" +
		"<element name='Melee'>" +
			"<interleave>" +
				"<element name='Hack' a:help='Hack damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Pierce' a:help='Pierce damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Crush' a:help='Crush damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='MaxRange' a:help='Maximum attack range (in metres)'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='RepeatTime' a:help='Time between attacks (in milliseconds). The attack animation will be stretched to match this time'>" + // TODO: it shouldn't be stretched
					"<data type='positiveInteger'/>" +
				"</element>" +
				Attack.prototype.bonusesSchema +
				Attack.prototype.preferredClassesSchema +
				Attack.prototype.restrictedClassesSchema +
			"</interleave>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='Ranged'>" +
			"<interleave>" +
				"<element name='Hack' a:help='Hack damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Pierce' a:help='Pierce damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Crush' a:help='Crush damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='MaxRange' a:help='Maximum attack range (in metres)'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='MinRange' a:help='Minimum attack range (in metres)'><ref name='nonNegativeDecimal'/></element>" +
				"<optional>"+
					"<element name='ElevationBonus' a:help='give an elevation advantage (in meters)'><ref name='nonNegativeDecimal'/></element>" +
				"</optional>" +
				"<element name='PrepareTime' a:help='Time from the start of the attack command until the attack actually occurs (in milliseconds). This value relative to RepeatTime should closely match the \"event\" point in the actor&apos;s attack animation'>" +
					"<data type='nonNegativeInteger'/>" +
				"</element>" +
				"<element name='RepeatTime' a:help='Time between attacks (in milliseconds). The attack animation will be stretched to match this time'>" +
					"<data type='positiveInteger'/>" +
				"</element>" +
				"<element name='ProjectileSpeed' a:help='Speed of projectiles (in metres per second). If unspecified, then it is a melee attack instead'>" +
					"<ref name='nonNegativeDecimal'/>" +
				"</element>" +
				"<element name='Spread' a:help='Radius over which missiles will tend to land (when shooting to the maximum range). Roughly 2/3 will land inside this radius (in metres). Spread is linearly diminished as the target gets closer.'><ref name='nonNegativeDecimal'/></element>" +
				Attack.prototype.bonusesSchema +
				Attack.prototype.preferredClassesSchema +
				Attack.prototype.restrictedClassesSchema +
				"<optional>" +
					"<element name='Splash'>" +
						"<interleave>" +
							"<element name='Shape' a:help='Shape of the splash damage, can be circular or linear'><text/></element>" +
							"<element name='Range' a:help='Size of the area affected by the splash'><ref name='nonNegativeDecimal'/></element>" +
							"<element name='FriendlyFire' a:help='Whether the splash damage can hurt non enemy units'><data type='boolean'/></element>" +
							"<element name='Hack' a:help='Hack damage strength'><ref name='nonNegativeDecimal'/></element>" +
							"<element name='Pierce' a:help='Pierce damage strength'><ref name='nonNegativeDecimal'/></element>" +
							"<element name='Crush' a:help='Crush damage strength'><ref name='nonNegativeDecimal'/></element>" +
							Attack.prototype.bonusesSchema +
						"</interleave>" +
					"</element>" +
				"</optional>" +
			"</interleave>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='Capture'>" +
			"<interleave>" +
				"<element name='Value' a:help='Capture points value'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='MaxRange' a:help='Maximum attack range (in meters)'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='RepeatTime' a:help='Time between attacks (in milliseconds). The attack animation will be stretched to match this time'>" + // TODO: it shouldn't be stretched
					"<data type='positiveInteger'/>" +
				"</element>" +
				Attack.prototype.bonusesSchema +
				Attack.prototype.preferredClassesSchema +
				Attack.prototype.restrictedClassesSchema +
			"</interleave>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='Charge'>" +
			"<interleave>" +
				"<element name='Hack' a:help='Hack damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Pierce' a:help='Pierce damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Crush' a:help='Crush damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='MaxRange'><ref name='nonNegativeDecimal'/></element>" + // TODO: how do these work?
				"<element name='MinRange'><ref name='nonNegativeDecimal'/></element>" +
				Attack.prototype.bonusesSchema +
				Attack.prototype.preferredClassesSchema +
				Attack.prototype.restrictedClassesSchema +
			"</interleave>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='Slaughter' a:help='A special attack to kill domestic animals'>" +
			"<interleave>" +
				"<element name='Hack' a:help='Hack damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Pierce' a:help='Pierce damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='Crush' a:help='Crush damage strength'><ref name='nonNegativeDecimal'/></element>" +
				"<element name='MaxRange'><ref name='nonNegativeDecimal'/></element>" + // TODO: how do these work?
				Attack.prototype.bonusesSchema +
				Attack.prototype.preferredClassesSchema +
				Attack.prototype.restrictedClassesSchema +
			"</interleave>" +
		"</element>" +
	"</optional>";

Attack.prototype.Init = function()
{
};

Attack.prototype.Serialize = null; // we have no dynamic state to save

Attack.prototype.GetAttackTypes = function()
{
	let ret = [];
	if (this.template.Charge) ret.push("Charge");
	if (this.template.Melee) ret.push("Melee");
	if (this.template.Ranged) ret.push("Ranged");
	if (this.template.Capture) ret.push("Capture");
	return ret;
};

Attack.prototype.GetPreferredClasses = function(type)
{
	if (this.template[type] && this.template[type].PreferredClasses &&
	    this.template[type].PreferredClasses._string)
	{
		return this.template[type].PreferredClasses._string.split(/\s+/);
	}
	return [];
};

Attack.prototype.GetRestrictedClasses = function(type)
{
	if (this.template[type] && this.template[type].RestrictedClasses &&
	    this.template[type].RestrictedClasses._string)
	{
		return this.template[type].RestrictedClasses._string.split(/\s+/);
	}
	return [];
};

Attack.prototype.CanAttack = function(target)
{
	let cmpFormation = Engine.QueryInterface(target, IID_Formation);
	if (cmpFormation)
		return true;

	let cmpThisPosition = Engine.QueryInterface(this.entity, IID_Position);
	let cmpTargetPosition = Engine.QueryInterface(target, IID_Position);
	if (!cmpThisPosition || !cmpTargetPosition || !cmpThisPosition.IsInWorld() || !cmpTargetPosition.IsInWorld())
		return false;

	// Check if the relative height difference is larger than the attack range
	// If the relative height is bigger, it means they will never be able to
	// reach each other, no matter how close they come.
	let heightDiff = Math.abs(cmpThisPosition.GetHeightOffset() - cmpTargetPosition.GetHeightOffset());

	const cmpIdentity = Engine.QueryInterface(target, IID_Identity);
	if (!cmpIdentity) 
		return undefined;

	const targetClasses = cmpIdentity.GetClassesList();

	for (let type of this.GetAttackTypes())
	{
		if (type == "Capture" && !QueryMiragedInterface(target, IID_Capturable))
			continue;

		if (type == "Slaughter" && targetClasses.indexOf("Domestic") == -1)
			continue;

		if (heightDiff > this.GetRange(type).max)
			continue;

		let restrictedClasses = this.GetRestrictedClasses(type);
		if (!restrictedClasses.length)
			return true;

		let canAttack = true;
		for (let targetClass of targetClasses)
		{
			if (restrictedClasses.indexOf(targetClass) == -1)
				continue;
			canAttack = false;
			break;
		}
		if (canAttack)
			return true;
	}

	return false;
};

/**
 * Returns null if we have no preference or the lowest index of a preferred class.
 */
Attack.prototype.GetPreference = function(target)
{
	const cmpIdentity = Engine.QueryInterface(target, IID_Identity);
	if (!cmpIdentity) 
		return undefined;

	const targetClasses = cmpIdentity.GetClassesList();

	let minPref = null;
	for (let type of this.GetAttackTypes())
	{
		let preferredClasses = this.GetPreferredClasses(type);
		for (let targetClass of targetClasses)
		{
			let pref = preferredClasses.indexOf(targetClass);
			if (pref === 0)
				return pref;
			if (pref != -1 && (minPref === null || minPref > pref))
				minPref = pref;
		}
	}
	return minPref;
};

/**
 * Get the full range of attack using all available attack types.
 */
Attack.prototype.GetFullAttackRange = function()
{
	let ret = { "min": Infinity, "max": 0 };
	for (let type of this.GetAttackTypes())
	{
		// Ignore the special attack "slaughter" dedicated to domestic animals
		if (type == "Slaughter")
			continue;
		let range = this.GetRange(type);
		if (range.min < ret.min)
			ret.min = range.min;
		if (range.max > ret.max)
			ret.max = range.max;
	}
	return ret;
};

Attack.prototype.GetBestAttackAgainst = function(target, allowCapture)
{
	let cmpFormation = Engine.QueryInterface(target, IID_Formation);
	if (cmpFormation)
	{
		// TODO: Formation against formation needs review
		let best = ["Ranged", "Melee", "Capture"];
		let types = this.GetAttackTypes();
		for (let attack of best)
			if (types.indexOf(attack) != -1)
				return attack;
		return undefined;
	}

	let cmpIdentity = Engine.QueryInterface(target, IID_Identity);
	if (!cmpIdentity) 
		return undefined;

	let targetClasses = cmpIdentity.GetClassesList();
	let isTargetClass = function (className) { return targetClasses.indexOf(className) != -1; };

	// Always slaughter domestic animals instead of using a normal attack
	if (isTargetClass("Domestic") && this.template.Slaughter) 
		return "Slaughter";

	let attack = this;
	let isAllowed = function (type) { return !attack.GetRestrictedClasses(type).some(isTargetClass); };

	let types = this.GetAttackTypes().filter(isAllowed);

	// check if the target is capturable
	let captureIndex = types.indexOf("Capture");
	if (captureIndex != -1)
	{
		let cmpCapturable = QueryMiragedInterface(target, IID_Capturable);

		let cmpPlayer = QueryOwnerInterface(this.entity);
		if (allowCapture && cmpPlayer && cmpCapturable && cmpCapturable.CanCapture(cmpPlayer.GetPlayerID()))
			return "Capture";
		// not captureable, so remove this attack
		types.splice(captureIndex, 1);
	}

	let isPreferred = function (className) { return attack.GetPreferredClasses(className).some(isTargetClass); };
	let byPreference = function (a, b) { return (types.indexOf(a) + (isPreferred(a) ? types.length : 0) ) - (types.indexOf(b) + (isPreferred(b) ? types.length : 0) ); };

	return types.sort(byPreference).pop();
};

Attack.prototype.CompareEntitiesByPreference = function(a, b)
{
	let aPreference = this.GetPreference(a);
	let bPreference = this.GetPreference(b);

	if (aPreference === null && bPreference === null) return 0;
	if (aPreference === null) return 1;
	if (bPreference === null) return -1;
	return aPreference - bPreference;
};

Attack.prototype.GetTimers = function(type)
{
	let prepare = +(this.template[type].PrepareTime || 0);
	prepare = ApplyValueModificationsToEntity("Attack/" + type + "/PrepareTime", prepare, this.entity);

	let repeat = +(this.template[type].RepeatTime || 1000);
	repeat = ApplyValueModificationsToEntity("Attack/" + type + "/RepeatTime", repeat, this.entity);

	return { "prepare": prepare, "repeat": repeat, "recharge": repeat - prepare };
};

Attack.prototype.GetAttackStrengths = function(type)
{
	// Work out the attack values with technology effects
	let template = this.template[type];
	let splash = "";
	if (!template)
	{
		template = this.template[type.split(".")[0]].Splash;
		splash = "/Splash";
	}

	let applyMods = damageType =>
		ApplyValueModificationsToEntity("Attack/" + type + splash + "/" + damageType, +(template[damageType] || 0), this.entity);

	if (type == "Capture")
		return { "value": applyMods("Value") };

	return {
		"hack": applyMods("Hack"),
		"pierce": applyMods("Pierce"),
		"crush": applyMods("Crush")
	};
};

Attack.prototype.GetRange = function(type)
{
	let max = +this.template[type].MaxRange;
	max = ApplyValueModificationsToEntity("Attack/" + type + "/MaxRange", max, this.entity);

	let min = +(this.template[type].MinRange || 0);
	min = ApplyValueModificationsToEntity("Attack/" + type + "/MinRange", min, this.entity);

	let elevationBonus = +(this.template[type].ElevationBonus || 0);
	elevationBonus = ApplyValueModificationsToEntity("Attack/" + type + "/ElevationBonus", elevationBonus, this.entity);

	return { "max": max, "min": min, "elevationBonus": elevationBonus };
};

// Calculate the attack damage multiplier against a target
Attack.prototype.GetAttackBonus = function(type, target)
{
	let attackBonus = 1;
	let template = this.template[type];
	if (!template)
		template = this.template[type.split(".")[0]].Splash;

	if (template.Bonuses)
	{
		let cmpIdentity = Engine.QueryInterface(target, IID_Identity);
		if (!cmpIdentity)
			return 1;

		// Multiply the bonuses for all matching classes
		for (let key in template.Bonuses)
		{
			let bonus = template.Bonuses[key];

			let hasClasses = true;
			if (bonus.Classes){
				let classes = bonus.Classes.split(/\s+/);
				for (let key in classes)
					hasClasses = hasClasses && cmpIdentity.HasClass(classes[key]);
			}

			if (hasClasses && (!bonus.Civ || bonus.Civ === cmpIdentity.GetCiv()))
				attackBonus *= bonus.Multiplier;
		}
	}

	return attackBonus;
};

// Returns a 2d random distribution scaled for a spread of scale 1.
// The current implementation is a 2d gaussian with sigma = 1
Attack.prototype.GetNormalDistribution = function(){

	// Use the Box-Muller transform to get a gaussian distribution
	let a = Math.random();
	let b = Math.random();

	let c = Math.sqrt(-2*Math.log(a)) * Math.cos(2*Math.PI*b);
	let d = Math.sqrt(-2*Math.log(a)) * Math.sin(2*Math.PI*b);

	return [c, d];
};

/**
 * Attack the target entity. This should only be called after a successful range check,
 * and should only be called after GetTimers().repeat msec has passed since the last
 * call to PerformAttack.
 */
Attack.prototype.PerformAttack = function(type, target)
{
	// If this is a ranged attack, then launch a projectile
	if (type == "Ranged")
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		let turnLength = cmpTimer.GetLatestTurnLength()/1000;
		// In the future this could be extended:
		//  * Obstacles like trees could reduce the probability of the target being hit
		//  * Obstacles like walls should block projectiles entirely

		// Get some data about the entity
		let horizSpeed = +this.template[type].ProjectileSpeed;
		let gravity = 9.81; // this affects the shape of the curve; assume it's constant for now

		let spread = +this.template.Ranged.Spread;
		spread = ApplyValueModificationsToEntity("Attack/Ranged/Spread", spread, this.entity);

		//horizSpeed /= 2; gravity /= 2; // slow it down for testing

		let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
		if (!cmpPosition || !cmpPosition.IsInWorld())
			return;
		let selfPosition = cmpPosition.GetPosition();
		let cmpTargetPosition = Engine.QueryInterface(target, IID_Position);
		if (!cmpTargetPosition || !cmpTargetPosition.IsInWorld())
			return;
		let targetPosition = cmpTargetPosition.GetPosition();

		let relativePosition = Vector3D.sub(targetPosition, selfPosition);
		let previousTargetPosition = Engine.QueryInterface(target, IID_Position).GetPreviousPosition();

		let targetVelocity = Vector3D.sub(targetPosition, previousTargetPosition).div(turnLength);
		// The component of the targets velocity radially away from the archer
		let radialSpeed = relativePosition.dot(targetVelocity) / relativePosition.length();

		let horizDistance = targetPosition.horizDistanceTo(selfPosition);

		// This is an approximation of the time ot the target, it assumes that the target has a constant radial 
		// velocity, but since units move in straight lines this is not true.  The exact value would be more 
		// difficult to calculate and I think this is sufficiently accurate.  (I tested and for cavalry it was 
		// about 5% of the units radius out in the worst case)
		let timeToTarget = horizDistance / (horizSpeed - radialSpeed);

		// Predict where the unit is when the missile lands.
		let predictedPosition = Vector3D.mult(targetVelocity, timeToTarget).add(targetPosition);

		// Compute the real target point (based on spread and target speed)
		let range = this.GetRange(type);
		let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
		let elevationAdaptedMaxRange = cmpRangeManager.GetElevationAdaptedRange(selfPosition, cmpPosition.GetRotation(), range.max, range.elevationBonus, 0);
		let distanceModifiedSpread = spread * horizDistance/elevationAdaptedMaxRange;

		let randNorm = this.GetNormalDistribution();
		let offsetX = randNorm[0] * distanceModifiedSpread * (1 + targetVelocity.length() / 20);
		let offsetZ = randNorm[1] * distanceModifiedSpread * (1 + targetVelocity.length() / 20);

		let realTargetPosition = new Vector3D(predictedPosition.x + offsetX, targetPosition.y, predictedPosition.z + offsetZ);

		// Calculate when the missile will hit the target position
		let realHorizDistance = realTargetPosition.horizDistanceTo(selfPosition);
		timeToTarget = realHorizDistance / horizSpeed;

		let missileDirection = Vector3D.sub(realTargetPosition, selfPosition).div(realHorizDistance);

		// Launch the graphical projectile
		let cmpProjectileManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ProjectileManager);
		let id = cmpProjectileManager.LaunchProjectileAtPoint(this.entity, realTargetPosition, horizSpeed, gravity);

		let playerId = Engine.QueryInterface(this.entity, IID_Ownership).GetOwner();
		cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		cmpTimer.SetTimeout(this.entity, IID_Attack, "MissileHit", timeToTarget * 1000, {
			"type": type,
			"target": target,
			"position": realTargetPosition,
			"direction": missileDirection,
			"projectileId": id,
			"playerId":playerId
		});
	}
	else if (type == "Capture")
	{
		let multiplier = this.GetAttackBonus(type, target);
		let cmpHealth = Engine.QueryInterface(target, IID_Health);
		if (!cmpHealth || cmpHealth.GetHitpoints() == 0)
			return;
		multiplier *= cmpHealth.GetMaxHitpoints() / cmpHealth.GetHitpoints();

		let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
		if (!cmpOwnership || cmpOwnership.GetOwner() == -1)
			return;

		let owner = cmpOwnership.GetOwner();
		let cmpCapturable = Engine.QueryInterface(target, IID_Capturable);
		if (!cmpCapturable || !cmpCapturable.CanCapture(owner))
			return;

		let strength = this.GetAttackStrengths("Capture").value * multiplier;
		if (cmpCapturable.Reduce(strength, owner))
			Engine.PostMessage(target, MT_Attacked, {
				"attacker": this.entity,
				"target": target,
				"type": type,
				"damage": strength
			});
	}
	else
	{
		// Melee attack - hurt the target immediately
		Damage.CauseDamage({
			"strengths": this.GetAttackStrengths(type),
			"target": target,
			"attacker": this.entity,
			"multiplier": this.GetAttackBonus(type, target),
			"type":type
		});
	}
	// TODO: charge attacks (need to design how they work)
};

Attack.prototype.InterpolatedLocation = function(ent, lateness)
{
	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	let turnLength = cmpTimer.GetLatestTurnLength()/1000;
	let cmpTargetPosition = Engine.QueryInterface(ent, IID_Position);
	if (!cmpTargetPosition || !cmpTargetPosition.IsInWorld()) // TODO: handle dead target properly
		return undefined;
	let curPos = cmpTargetPosition.GetPosition();
	let prevPos = cmpTargetPosition.GetPreviousPosition();
	lateness /= 1000;
	return new Vector3D((curPos.x * (turnLength - lateness) + prevPos.x * lateness) / turnLength,
			0,
	        (curPos.z * (turnLength - lateness) + prevPos.z * lateness) / turnLength);
};

// Tests whether it point is inside of ent's footprint
Attack.prototype.testCollision = function(ent, point, lateness)
{
	let targetPosition = this.InterpolatedLocation(ent, lateness);
	if (!targetPosition)
		return false;
	let cmpFootprint = Engine.QueryInterface(ent, IID_Footprint);
	if (!cmpFootprint)
		return false;
	let targetShape = cmpFootprint.GetShape();

	if (!targetShape || !targetPosition)
		return false;

	if (targetShape.type === 'circle')
	{
		// Use VectorDistanceSquared and square targetShape.radius to avoid square roots.
		return (targetPosition.horizDistanceTo(point) < (targetShape.radius * targetShape.radius));
	}
	else
	{
		let angle = Engine.QueryInterface(ent, IID_Position).GetRotation().y;

		let d = Vector3D.sub(point, targetPosition);
		d = Vector2D.from3D(d).rotate(-angle);

		return d.x < Math.abs(targetShape.width/2) && d.y < Math.abs(targetShape.depth/2);
	}
};

Attack.prototype.MissileHit = function(data, lateness)
{
	let targetPosition = this.InterpolatedLocation(data.target, lateness);
	if (!targetPosition)
		return;

	if (this.template.Ranged.Splash) // splash damage, do this first in case the direct hit kills the target
	{
		let friendlyFire = this.template.Ranged.Splash.FriendlyFire;
		let splashRadius = this.template.Ranged.Splash.Range;
		let splashShape = this.template.Ranged.Splash.Shape;
		let playersToDamage;
		// If friendlyFire isn't enabled, get all player enemies to pass to "Damage.CauseSplashDamage".
		if (friendlyFire == "false")
		{
			let cmpPlayer = QueryPlayerIDInterface(data.playerId);
			playersToDamage = cmpPlayer.GetEnemies();
		}
		// Damage the units.
		Damage.CauseSplashDamage({
			"attacker": this.entity,
			"origin": Vector2D.from3D(data.position),
			"radius": splashRadius,
			"shape": splashShape,
			"strengths": this.GetAttackStrengths(data.type),
			"direction": data.direction,
			"playersToDamage": playersToDamage,
			"type":data.type
		});
	}

	if (this.testCollision(data.target, data.position, lateness))
	{
		data.attacker = this.entity;
		data.multiplier = this.GetAttackBonus(data.type, data.target);
		data.strengths = this.GetAttackStrengths(data.type);
		// Hit the primary target
		Damage.CauseDamage(data);

		// Remove the projectile
		let cmpProjectileManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ProjectileManager);
		cmpProjectileManager.RemoveProjectile(data.projectileId);
	}
	else
	{
		// If we didn't hit the main target look for nearby units
		let cmpPlayer = QueryPlayerIDInterface(data.playerId);
		let ents = Damage.EntitiesNearPoint(Vector2D.from3D(data.position), targetPosition.horizDistanceTo(data.position) * 2, cmpPlayer.GetEnemies());

		for (let i = 0; i < ents.length; ++i)
		{
			if (this.testCollision(ents[i], data.position, lateness))
			{
				Damage.CauseDamage({
						"strengths": this.GetAttackStrengths(data.type),
						"target": ents[i],
						"attacker": this.entity,
						"multiplier": this.GetAttackBonus(data.type, ents[i]),
						"type": data.type
				});
				// Remove the projectile
				let cmpProjectileManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ProjectileManager);
				cmpProjectileManager.RemoveProjectile(data.projectileId);
			}
		}
	}
};

Attack.prototype.OnValueModification = function(msg)
{
	if (msg.component != "Attack")
		return;

	let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	if (!cmpUnitAI)
		return;

	for (let type of this.GetAttackTypes())
		if (msg.valueNames.indexOf("Attack/"+type+"/MaxRange") !== -1)
		{
			cmpUnitAI.UpdateRangeQueries();
			return;
		}
};

Engine.RegisterComponentType(IID_Attack, "Attack", Attack);
