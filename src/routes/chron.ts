import { MoreThan, Not, getConnection, getRepository } from 'typeorm'
// import ClanInvite from '../entity/ClanInvite'
import Empire from '../entity/Empire'
import Market from '../entity/Market'
import {
	TURNS_COUNT,
	TURNS_MAXIMUM,
	TURNS_STORED,
	TURNS_UNSTORE,
	MAX_ATTACKS,
	MAX_SPELLS,
	DR_RATE,
	PUBMKT_MAXTIME,
	PUBMKT_START,
	AID_MAXCREDITS,
	LOTTERY_JACKPOT,
	TURNS_PROTECTION,
} from '../config/conifg'
import EmpireEffect from '../entity/EmpireEffect'
// import User from '../entity/User'
import { getNetworth } from '../routes/actions/actions'
import Session from '../entity/Session'
import { eraArray } from '../config/eras'
import { createNewsEvent } from '../util/helpers'
import Lottery from '../entity/Lottery'
import { Request, Response, Router } from 'express'
import EmpireSnapshot from '../entity/EmpireSnapshot'
import User from '../entity/User'

// perform standard turn update events
const promTurns = async (req: Request, res: Response) => {
	// max turns 500, max stored turns 250
	if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
		return res.status(401).end('Unauthorized')
	}

	try {
		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update turns
				turns: () =>
					`turns + ${TURNS_COUNT} + LEAST(storedTurns, ${TURNS_UNSTORE}), storedTurns = storedTurns - LEAST(storedTurns, ${TURNS_UNSTORE})`,
			})
			.where('vacation = 0 AND id != 0 AND mode != :mode', { mode: 'demo' })
			.execute()

		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update stored turns
				storedturns: () =>
					`LEAST(${TURNS_STORED}, storedTurns + turns - ${TURNS_MAXIMUM}), turns = ${TURNS_MAXIMUM} `,
			})
			.where('turns > :turnsMax AND id != 0 AND mode != :mode', {
				mode: 'demo',
				turnsMax: TURNS_MAXIMUM,
			})
			.execute()

		// Reduce maximum private market sell percentage (by 1% base, up to 2% if the player has nothing but bldcash)
		// TODO: can't figure out what this is doing...
		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				mktPerArm: () =>
					'mkt_per_arm - LEAST(mkt_per_arm, 100 * (1 + bld_cash / land))',
				mktPerLnd: () =>
					'mkt_per_lnd - LEAST(mkt_per_lnd, 100 * (1 + bld_cash / land))',
				mktPerFly: () =>
					'mkt_per_fly - LEAST(mkt_per_fly, 100 * (1 + bld_cash / land))',
				mktPerSea: () =>
					'mkt_per_sea - LEAST(mkt_per_sea, 100 * (1 + bld_cash / land))',
			})
			.where('land != 0 AND id != 0')
			.execute()

		// await getConnection()
		// 	.createQueryBuilder()
		// 	.update(Empire)
		// 	.set({
		// 		// update price on private market
		// 		mktPerLnd: () =>
		// 			'mkt_Per_Lnd - LEAST(mkt_Per_Lnd, 100 * (1 + bld_Cash / land))',
		// 	})
		// 	.where('land != 0 AND id != 0')
		// 	.execute()

		// await getConnection()
		// 	.createQueryBuilder()
		// 	.update(Empire)
		// 	.set({
		// 		// update price on private market
		// 		mktPerFly: () =>
		// 			'mkt_Per_Fly - LEAST(mkt_Per_Fly, 100 * (1 + bld_Cash / land))',
		// 	})
		// 	.where('land != 0 AND id != 0')
		// 	.execute()

		// await getConnection()
		// 	.createQueryBuilder()
		// 	.update(Empire)
		// 	.set({
		// 		// update price on private market
		// 		mktPerSea: () =>
		// 			'mkt_Per_Sea - LEAST(mkt_Per_Sea, 100 * (1 + bld_Cash / land))',
		// 	})
		// 	.where('land != 0 AND id != 0')
		// 	.execute()

		// refill private market based on bldCost, except for food bldFood
		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update available quantity on market
				mktArm: () => 'mkt_arm + (8 * (land + bld_cost)*0.75)',
			})
			.where('mkt_arm / 250 < land + 2 * bld_cost AND id != 0')
			.execute()

		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update available quantity on market
				mktLnd: () => 'mkt_lnd + (5 * (land + bld_cost)*0.75)',
			})
			.where('mkt_lnd / 250 < land + 2 * bld_cost AND id != 0')
			.execute()

		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update available quantity on market
				mktFly: () => 'mkt_fly + (3 * (land + bld_cost)*0.75)',
			})
			.where('mkt_fly / 250 < land + 2 * bld_cost AND id != 0')
			.execute()

		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update available quantity on market
				mktSea: () => 'mkt_sea + (2 * (land + bld_cost)*0.75)',
			})
			.where('mkt_sea / 250 < land + 2 * bld_cost AND id != 0')
			.execute()

		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update available quantity on market
				mktFood: () => 'mkt_food + (50 * (land + bld_cost) * 0.8)',
			})
			.where('mkt_food / 3500 < land + 2 * bld_cost AND id != 0')
			.execute()

		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update available quantity on market
				mktRunes: () => 'mkt_runes + (8 * (land + bld_cost)*0.9)',
			})
			.where('mkt_runes / 200 < land + 2 * bld_cost AND id != 0')
			.execute()

		// clan troop sharing
		// await getConnection()
		// 	.createQueryBuilder()
		// 	.update(Empire)
		// 	.set({
		// 		// update available quantity on market
		// 		sharing: () => 'sharing - 1',
		// 	})
		// 	.where('sharing > 0 AND id != 0')
		// 	.execute()

		// clean up expired clan invites
		console.log('updating ranks')
		const empires = await Empire.find({ order: { networth: 'DESC' } })
		let uRank = 0

		for (let i = 0; i < empires.length; i++) {
			uRank++
			let id = empires[i].id
			await getConnection()
				.createQueryBuilder()
				.update(Empire)
				.set({
					// update rank
					rank: uRank,
				})
				.where('id = :id', { id: id })
				.execute()
		}

		const snapEmpires = empires.filter(
			(emp) => emp.turnsUsed > TURNS_PROTECTION - 1 && emp.mode !== 'demo'
		)

		for (let i = 0; i < snapEmpires.length; i++) {
			console.log('taking snapshot')
			const empire = snapEmpires[i]
			const snapshot = new EmpireSnapshot(empire)
			// console.log(empire)
			snapshot.e_id = empire.id
			snapshot.createdAt = new Date()
			await snapshot.save()
		}

		console.log('Turns update', new Date())
		return res.status(200).json({ message: 'Turns updated' })
	} catch (err) {
		console.log(err)
		return res
			.status(500)
			.json({ message: 'Something went wrong in turn update' })
	}
}

const thirtyMinUpdate = async (req: Request, res: Response) => {
	if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
		return res.status(401).end('Unauthorized')
	}
	try {
		// max attack counter
		if (MAX_ATTACKS > 0) {
			await getConnection()
				.createQueryBuilder()
				.update(Empire)
				.set({
					// update number of attacks
					attacks: () => 'attacks - 1',
				})
				.where('attacks > 0 AND id != 0')
				.execute()
		}

		if (MAX_SPELLS > 0) {
			await getConnection()
				.createQueryBuilder()
				.update(Empire)
				.set({
					// update number of spells
					spells: () => 'spells - 1',
				})
				.where('spells > 0 AND id != 0')
				.execute()
		}

		if (DR_RATE > 0) {
			await getConnection()
				.createQueryBuilder()
				.update(Empire)
				.set({
					diminishingReturns: () => `diminishing_returns - ${DR_RATE / 2}`,
				})
				.where('diminishing_returns > 0 AND id != 0')
				.execute()
			await getConnection()
				.createQueryBuilder()
				.update(Empire)
				.set({
					diminishingReturns: () => '0',
				})
				.where('diminishing_returns < 0 AND id != 0')
				.execute()
		}
		// max time on market 72 hours
		console.log('cleaning market')
		// take unsold market items and return them to the empire
		const now = new Date()
		const maxTime = (PUBMKT_START + PUBMKT_MAXTIME) * 60 * 60 * 1000 // 78 hours in milliseconds
		const oldestDate = new Date(now.getTime() - maxTime)

		const items = await getRepository(Market)
			.createQueryBuilder('market')
			.where('market.createdAt <= :oldestDate', { oldestDate })
			.getMany()

		console.log(items)

		let itemsArray = ['trpArm', 'trpLnd', 'trpFly', 'trpSea', 'food', 'runes']

		for (let i = 0; i < items.length; i++) {
			//return unsold goods
			let item = items[i]
			console.log(item)
			const itemName = itemsArray[item.type]
			console.log(itemName)
			const empire = await Empire.findOne({ id: item.empire_id })
			empire[itemName] += Math.round(item.amount * 0.75)
			empire.networth = getNetworth(empire)

			// news event for expired market item
			// create news entry
			let sourceId = empire.id
			let sourceName = empire.name
			let destinationId = empire.id
			let destinationName = empire.name
			let content: string = `Your ${
				eraArray[empire.era][itemName.toLowerCase()]
			} on the public market have expired and 75% have been returned to you.`
			let pubContent: string = `${empire.name} failed to sell their items on the public market.`

			// create news event for seller that goods have been purchased
			await createNewsEvent(
				content,
				pubContent,
				sourceId,
				sourceName,
				destinationId,
				destinationName,
				'market',
				'fail'
			)

			await empire.save()
			await item.remove()
		}
		console.log('30 minute update')
		return res.status(200).json({ message: '30 minute update' })
	} catch (err) {
		console.log(err)
		return res
			.status(500)
			.json({ message: 'Something went wrong in 30 minute update' })
	}
}

const hourlyUpdate = async (req: Request, res: Response) => {
	if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
		return res.status(401).end('Unauthorized')
	}
	try {
		console.log('performing hourly update')
		if (MAX_ATTACKS > 0) {
			await getConnection()
				.createQueryBuilder()
				.update(Empire)
				.set({
					// update number of attacks
					attacks: () => 'attacks + 1',
				})
				.where('attacks < 0 AND id != 0')
				.execute()
		}

		if (MAX_SPELLS > 0) {
			await getConnection()
				.createQueryBuilder()
				.update(Empire)
				.set({
					// update number of spells
					spells: () => 'spells + 1',
				})
				.where('spells < 0 AND id != 0')
				.execute()
		}

		return res.status(200).json({ message: 'Hourly update' })
	} catch (err) {
		console.log(err)
		return res
			.status(500)
			.json({ message: 'Something went wrong in hourly update' })
	}
}

const aidCredits = async (req: Request, res: Response) => {
	if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
		return res.status(401).end('Unauthorized')
	}

	try {
		// add aid credits
		console.log('adding aid credits')
		await getConnection()
			.createQueryBuilder()
			.update(Empire)
			.set({
				// update number of credits
				aidCredits: () => 'aid_credits + 1',
			})
			.where('id != 0 AND aid_credits < :max AND mode != :mode', {
				mode: 'demo',
				max: AID_MAXCREDITS,
			})
			.execute()
		return res.status(200).json({ message: 'Aid credits added' })
	} catch (err) {
		console.log(err)
		return res
			.status(500)
			.json({ message: 'Something went wrong in aid credits' })
	}
}

// export const cleanMarket = new AsyncTask('clean market', async () => {})

// export const updateRanks = new AsyncTask('update ranks', async () => {

// })
function isOld(updatedAt, effectValue) {
	let effectAge = (Date.now().valueOf() - new Date(updatedAt).getTime()) / 60000
	effectAge = Math.floor(effectAge)

	// console.log(effectAge)
	// console.log(effectValue)

	if (effectAge > effectValue) {
		return true
	} else {
		return false
	}
}

const cleanDemoAccounts = async (req: Request, res: Response) => {
	if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
		return res.status(401).end('Unauthorized')
	}

	try {
		console.log('cleaning demo accounts and effects')

		await getConnection()
			.createQueryBuilder()
			.delete()
			.from(Empire)
			.where('mode = :gamemode AND turnsUsed < :protection', {
				gamemode: 'demo',
				protection: TURNS_PROTECTION,
			})
			.execute()

		// let emptyUsers = await User.find({
		// 	relations: ['empires'],
		// 	where: { empires: [] },
		// })

		// emptyUsers.forEach(async (user) => {
		// 	await user.remove()
		// })

		let effects = await EmpireEffect.find()

		effects.forEach(async (effect) => {
			let old = isOld(effect.updatedAt, effect.empireEffectValue)
			if (old) {
				effect.remove()
			}
		})

		// clear old sessions
		// if createdAt date is older than 1 day, delete
		await getConnection()
			.createQueryBuilder()
			.delete()
			.from(Session)
			.where('createdAt < :date', { date: new Date(Date.now() - 86400000) })
			.execute()

		// determine how to pick a winner
		// get total number of tickets, multiply by 1.25, round up, that is the number of tickets to draw
		// pick a random number between 1 and the total number of tickets
		// find the ticket with that number
		// that empire wins the prize
		console.log('checking lottery')

		const allTickets = await Lottery.find()

		let jackpot = 0
		const jackpotTracker = await Lottery.findOne({ ticket: 0 })
		// console.log(jackpotTracker)
		if (!jackpotTracker) {
			for (let i = 0; i < allTickets.length; i++) {
				jackpot += Number(allTickets[i].cash)
			}
			jackpot += LOTTERY_JACKPOT
		} else {
			for (let i = 0; i < allTickets.length; i++) {
				if (allTickets[i].ticket != 0) {
					jackpot += Number(allTickets[i].cash)
				}
			}
			jackpot += Number(jackpotTracker.cash)
		}

		// console.log('jackpot', jackpot)

		const totalTickets = allTickets.length
		if (totalTickets < 1) return
		// console.log('total tickets', totalTickets)
		let ticketsToDraw = Math.ceil(totalTickets * 1.35)
		if (ticketsToDraw < 15) ticketsToDraw = 15
		// console.log('tickets to draw', ticketsToDraw)
		const winningTicket = Math.ceil(Math.random() * ticketsToDraw)
		// console.log('winning ticket', winningTicket)

		// check if all tickets contains a ticket with the winning number
		// console.log(allTickets)
		const winner = allTickets.find(({ ticket }) => ticket == winningTicket)
		// console.log('winner', winner)

		if (!winner || totalTickets < 1 || winningTicket < 1) {
			console.log('no winner')
			// remove old tickets
			await getConnection()
				.createQueryBuilder()
				.delete()
				.from(Lottery)
				.execute()

			// create jackpot entry as ticket 0
			const ticket = new Lottery()
			ticket.empire_id = 0
			ticket.cash = jackpot
			ticket.ticket = 0
			await ticket.save()

			// news event for no lottery winner
			// create news entry
			let sourceId = 0
			let sourceName = ''
			let destinationId = 0
			let destinationName = ''
			let content: string = ''
			let pubContent: string = `No one won the lottery. The base jackpot has increased to $${jackpot.toLocaleString()}.`

			// create news event
			await createNewsEvent(
				content,
				pubContent,
				sourceId,
				sourceName,
				destinationId,
				destinationName,
				'lottery',
				'fail'
			)
		} else {
			// console.log('winner', winner)
			// console.log(jackpot)
			const empire = await Empire.findOne({ id: winner.empire_id })
			// console.log(empire)
			empire.cash += jackpot
			await empire.save()

			// news event for lottery winner
			// create news entry
			let sourceId = empire.id
			let sourceName = empire.name
			let destinationId = empire.id
			let destinationName = empire.name
			let content: string = `You won $${jackpot.toLocaleString()} in the lottery!`
			let pubContent: string = `${
				empire.name
			} won $${jackpot.toLocaleString()} in the lottery!`

			// create news event
			await createNewsEvent(
				content,
				pubContent,
				sourceId,
				sourceName,
				destinationId,
				destinationName,
				'lottery',
				'success'
			)

			// remove all tickets
			await getConnection()
				.createQueryBuilder()
				.delete()
				.from(Lottery)
				.execute()
		}

		// sync achievements to user
		try {
			const empires = await Empire.find({
				select: ['id', 'achievements'],
				relations: ['user'],
			})

			// loop through empires, sync achievements to user
			for (let i = 0; i < empires.length; i++) {
				const empire = empires[i]
				const user = await User.findOne({ id: empire.user.id })

				// compare empire achievements to user achievements
				// if an achievement was earned on the empire, add it to the user

				let newUserAchievements
				if (Object.keys(user.achievements).length === 0) {
					newUserAchievements = empire.achievements
				} else {
					newUserAchievements = user.achievements
				}

				Object.keys(empire.achievements).forEach((key) => {
					// console.log(empire.achievements[key])
					// console.log(newUserAchievements[key])
					if (
						empire.achievements[key].awarded === true &&
						newUserAchievements[key].awarded === false
					) {
						newUserAchievements[key].awarded = true
						newUserAchievements[key].timeAwarded =
							empire.achievements[key].timeAwarded
					}
				})

				user.achievements = newUserAchievements
				await user.save()
			}
		} catch (err) {
			console.log(err)
		}

		return res
			.status(200)
			.json({ message: 'Demo accounts cleaned, Lottery, achievements sync' })
	} catch (err) {
		console.log(err)
		return res
			.status(500)
			.json({ message: 'Something went wrong in clean demo accounts' })
	}
}

const test = async (req: Request, res: Response) => {
	console.log(req.headers)
	if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
		return res.status(401).end('Unauthorized')
	}

	try {
		console.log('test')
		return res.status(200).json({ message: 'test' })
	} catch (err) {
		console.log(err)
		return res.status(500).json({ message: 'Something went wrong in test' })
	}
}

// MOVED TO PROMTURNS
// empire snapshots, save empire stats every 4 hours to a separate table
// can use snapshots to create graphs of empire stats over time
// const empireSnapshots = async (req: Request, res: Response) => {
// 	if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
// 		return res.status(401).end('Unauthorized')
// 	}

// 	try {
// 		// loop over empires, save each empire to separate snapshot row
// 		const empires = await Empire.find({
// 			where: { turnsUsed: MoreThan(TURNS_PROTECTION - 1), mode: Not('demo') },
// 		})

// 		for (let i = 0; i < empires.length; i++) {
// 			console.log('taking snapshot')
// 			const empire = empires[i]
// 			const snapshot = new EmpireSnapshot(empire)
// 			// console.log(empire)
// 			snapshot.e_id = empire.id
// 			snapshot.createdAt = new Date()
// 			await snapshot.save()
// 		}

// 		return res.status(200).json({ message: 'snapshot' })
// 	} catch (err) {
// 		console.log(err)
// 		return res.status(500).json({ message: 'Something went wrong in snapshot' })
// 	}
// }

const router = Router()

router.get('/test', test)
router.get('/turns', promTurns)
router.get('/thirty', thirtyMinUpdate)
router.get('/hourly', hourlyUpdate)
router.get('/aid', aidCredits)
router.get('/daily', cleanDemoAccounts)
// router.get('/snapshot', empireSnapshots)

export default router
