import Empire from '../../entity/Empire'
import { raceArray } from '../../config/races'
import { eraArray } from '../../config/eras'
import { PVTM_FOOD, PVTM_TRPARM, PVTM_TRPFLY, PVTM_TRPLND, PVTM_TRPSEA } from '../../config/conifg'

export const exploreAlt = (empire: Empire) => {
	const land = giveLand(empire)
	empire.land += land
	empire.freeLand += land
	return land
}

export const calcSizeBonus = ({ networth }) => {
	let net = Math.max(networth, 1)
	let size = Math.atan(generalLog(net, 1000) - 1) * 2.1 - 0.65
	size = Math.round(Math.min(Math.max(0.5, size), 1.7) * 1000) / 1000
	return size
}


export const calcPCI = (empire: Empire) => {
	const { bldCash, land, race } = empire
	return Math.round(25 *
		(1 + bldCash / Math.max(land, 1))
		* ((100 + raceArray[race].mod_income) / 100))
	
}

export const giveLand = (empire: Empire) => {
	return Math.ceil((1 / (empire.land * 0.00019 + 0.25)) * 40 * ((100 + eraArray[empire.era].mod_explore + raceArray[empire.race].mod_explore) / 100))
	
}

export const getNetworth = (empire: Empire) => {
	let networth = 0

	//troops
	networth += empire.trpArm * 1
	networth += (empire.trpLnd * PVTM_TRPLND) / PVTM_TRPARM
	networth += (empire.trpFly * PVTM_TRPFLY) / PVTM_TRPARM
	networth += (empire.trpSea * PVTM_TRPSEA) / PVTM_TRPARM
	networth += empire.trpWiz * 2
	networth += empire.peasants * 3
	// Cash
	networth += (empire.cash + empire.bank / 2 - empire.loan * 2) / (5 * PVTM_TRPARM)
	networth += empire.land * 500
	networth += empire.freeLand * 100

	// Food, reduced using logarithm to prevent it from boosting networth to ludicrous levels
	networth += (empire.food / Math.log10(Math.max(10, empire.food))) * (PVTM_FOOD / PVTM_TRPARM)

	return Math.max(0, Math.floor(networth))
}

function generalLog(number: number, base: number) {
	return Math.log(base) / Math.log(number)
}
