import * as Discord from "discord.js";
import { IDatabase } from "../interfaces/IDatabase";
import { User } from "../models/User.model";
import { IUser } from "../interfaces/IUSer";
import { minifyBalance, getAmount, getMultiplier, getServer, generateHash, roll, embeddedInstance, embeddedError, embeddedRollimage, getGameType } from "../utils/Utils";
import { IGames } from "../interfaces/IGames";
import moment from 'moment';
import { ITransactions } from "../interfaces/ITransactions";
export class Responses {
    server: Discord.Guild;
    userInstance: IUser;
    gamesInstance: IGames;
    txInstance: ITransactions;
    commands = ['!help', '@help', '!commands', '@commands', '!balance', '@balance',
        '!wallet', '@wallet', '!deposit', '@deposit', '!cashin', '@cashin', '!cashout', '@cashout',
        '!withdraw', '@withdraw', '!pair', '@pair', '!verify', '@verify', '!random', '@random',
        '!statistics', '@statistics',
        '!txs', '@txs', '!transactions', '@transactions',
        '!44x2', '@44x2', '!54x2', '@54x2',
        '!92x10', '@92x10', '!75x3', '@75x3',
        '!weekly', '@weekly',
        '@weeklystatistics', '!weeklystatistics',
        '!allowed', '@allowed'
    ];

    constructor(server: Discord.Guild, userInstance: IUser, gamesInstance: IGames, txInstance: ITransactions) {
        this.server = server;
        this.userInstance = userInstance;
        this.gamesInstance = gamesInstance;
        this.txInstance = txInstance;
    }

    async reply(msg: Discord.Message) {
        const messages = msg.content.trim().toLowerCase().split(' ');
        const command = messages[0];
        const mentionedMember: any = msg.mentions.members !== null ? (msg.mentions.members.size > 0 ? msg.mentions.members.first() : null) : null;
        const now: moment.Moment = moment();
        if (this.commands.indexOf(command) === -1) {
            return;
        }
        const { id, username, tag } = msg.member.user;
        switch (command) {
            case '!commands':
            case '@commands':
            case '!help':
            case '@help':
                const commands = this.commands.join(', ');
                msg.reply(embeddedInstance(`Current available commands:`, commands));
                break;
            case '!balance':
            case '@balance':
            case '!wallet':
            case '@wallet':
                if (messages.length === 1) {
                    const user: User = await this.userInstance.getUser(id);
                    msg.reply(embeddedInstance(`${username}'s wallet:`, `RS3: ${minifyBalance(user.BalanceRs)}\nOSRS: ${minifyBalance(user.BalanceOsrs)}`));
                } else if (messages.length === 2) {
                    const depositRole: Discord.Role = msg.member.roles.find(role => role.id === process.env.DISCORD_CASHIER_GROUP_ID);
                    if (!depositRole) {
                        msg.reply(embeddedError(`You do not have access to view another user's wallet.`));
                        return;
                    }
                    if (mentionedMember) {
                        const user: User = await this.userInstance.getUser(mentionedMember.user.id);
                        msg.reply(embeddedInstance(`${mentionedMember.displayName}'s wallet:`, `RS3: ${minifyBalance(user.BalanceRs)}\nOSRS: ${minifyBalance(user.BalanceOsrs)}`));
                    } else {
                        msg.reply(embeddedError(`Please select a user to check his wallet.`));
                    }
                }
                break;
            case '!deposit':
            case '@deposit':
            case '!cashin':
            case '@cashin':
                /**
                 * [@!deposit] [amount] [07/rs3] [target]
                 */
                if (messages.length === 4) {
                    const server = messages[2];
                    const amount = messages[1];

                    const depositRole: Discord.Role = msg.member.roles.find(role => role.id === process.env.DISCORD_CASHIER_GROUP_ID);
                    if (server !== '07' && server !== 'rs3') {
                        msg.reply(embeddedError(`Invalid server to deposit on.`));
                        return;
                    }

                    if (getAmount(amount) === 0) {
                        msg.reply(embeddedError(`Invalid amount to deposit.`));
                        return;
                    }

                    if (!amount.includes('k') && !amount.includes('m') && !amount.includes('b')) {
                        msg.reply(embeddedError(`Invalid currency to use.`));
                        return;
                    }
                    const processEnvMaxCashin: any = process.env.DISCORD_CASHIER_MAX_CASHIN;

                    if (getAmount(processEnvMaxCashin) < getAmount(amount)) {
                        msg.reply(embeddedError(`Cannot cash in more than allowed.`));
                        return;
                    }

                    if (!depositRole) {
                        msg.reply(embeddedError(`You do not have access to deposit funds.`));
                        return;
                    }

                    if (!mentionedMember) {
                        msg.reply(embeddedError(`Please select a user to add funds to their wallet.`));
                        return;
                    }

                    if (!messages[3].includes(mentionedMember.user.id)) {
                        msg.reply(embeddedError(`User id doesn't match mentioned user.`));
                        return;
                    }

                    try {
                        const targetUser = await this.userInstance.getUser(mentionedMember.user.id);
                        const osrs = server === '07';
                        const targetCurrentBalance = osrs ? targetUser.BalanceOsrs : targetUser.BalanceRs;
                        const amountToAdd = getAmount(amount) * getMultiplier(amount);
                        const newBalance = amountToAdd + targetCurrentBalance;

                        const updateBalance = await this.userInstance.updateUser(mentionedMember.user.id, osrs, newBalance);
                        const addTx = await this.txInstance.addTransaction(id, mentionedMember.user.id, `${amountToAdd}`, getServer(osrs), true);
                        msg.reply(embeddedInstance(`CashIn`, `Successfully deposited ${amount} to ${mentionedMember}'s ${getServer(osrs)} wallet.`));

                    } catch (error) {
                        console.log(error);
                    }
                }
                break;
            case '!cashout':
            case '@cashout':
            case '!withdraw':
            case '@withdraw':
                if (messages.length === 4) {
                    const server = messages[2];
                    const amount = messages[1];

                    const depositRole: Discord.Role = msg.member.roles.find(role => role.id === process.env.DISCORD_CASHIER_GROUP_ID);
                    if (server !== '07' && server !== 'rs3') {
                        msg.reply(embeddedError(`Invalid server to withdraw from.`));
                        return;
                    }

                    if (getAmount(amount) === 0) {
                        msg.reply(embeddedError(`Invalid amount to withdraw.`));
                        return;
                    }

                    if (!amount.includes('k') && !amount.includes('m') && !amount.includes('b')) {
                        msg.reply(embeddedError(`Invalid currency to use.`));
                        return;
                    }

                    const processEnvMaxCashout: any = process.env.DISCORD_CASHIER_MAX_CASHOUT;

                    if (getAmount(processEnvMaxCashout) < getAmount(amount)) {
                        msg.reply(embeddedError(`Cannot cash out more than allowed.`));
                        return;
                    }

                    if (!depositRole) {
                        msg.reply(embeddedError(`You do not have access to withdraw funds.`));
                        return;
                    }

                    if (!mentionedMember) {
                        msg.reply(embeddedError(`Please select a user to withdraw funds from their wallet.`));
                        return;
                    }

                    if (!messages[3].includes(mentionedMember.user.id)) {
                        msg.reply(embeddedError(`User id doesn't match mentioned user.`));
                        return;
                    }
                    try {
                        const targetUser = await this.userInstance.getUser(mentionedMember.user.id);
                        const osrs = server === '07';
                        const targetCurrentBalance = osrs ? targetUser.BalanceOsrs : targetUser.BalanceRs;
                        const amountToDeduce = getAmount(amount) * getMultiplier(amount);
                        const newBalance = targetCurrentBalance - amountToDeduce;
                        if (newBalance < 0) {
                            msg.reply(embeddedError(`User cannot withdraw more than available funds in their wallet.`));
                            return;
                        }
                        const updateBalance = await this.userInstance.updateUser(mentionedMember.user.id, osrs, newBalance);
                        const addTx = await this.txInstance.addTransaction(id, mentionedMember.user.id, `-${amountToDeduce}`, getServer(osrs), false);
                        msg.reply(embeddedInstance(`CashOut`, `Successfully withdrew ${amount} from ${mentionedMember}'s ${getServer(osrs)} wallet.`));
                    } catch (error) {
                        console.log(error);
                    }
                }
                break;

            case '!weekly':
            case '@weekly':
                if (messages.length == 2) {
                    const server = messages[2];
                    if (server !== '07' && server !== 'rs3') {
                        msg.reply(embeddedError(`Invalid server to check statistics on.`));
                        return;
                    }
                    let serverType = server === '07' ? 'OSRS' : 'RS3';
                    const results = await this.userInstance.getUsersWeeklyStatistics(serverType, now.week() - 1);
                    let reply = '';
                    if (results.length === 1) {
                        if (results[0].Id === null) {
                            reply = 'No data to display'
                        } else {
                            for (let i = 0; i < results.length; i++) {
                                const result = results[i];
                                const user = this.server.members.find(member => member.id === result.Uuid);
                                reply += `**#${i + 1} ${user ? user : result.Uuid}** - ${minifyBalance(result.Sum)}\n`;
                            }
                        }
                    }
                    msg.reply(embeddedInstance(`__Top 10 players statistics (week ${now.week()})__:`, reply, '00ffef'));
                }
                break;

            case '!statistics':
            case '@statistics':
                if (messages.length >= 2) {
                    const server = messages[2];
                    if (server !== '07' && server !== 'rs3') {
                        msg.reply(embeddedError(`Invalid server to check statistics on.`));
                        return;
                    }
                    let serverType = server === '07' ? 'OSRS' : 'RS3';
                    const results = await this.userInstance.getUsersStatistics(serverType);
                    let reply = '';
                    if (results.length === 1) {
                        if (results[0].Id === null) {
                            reply = 'No data to display'
                        } else {
                            for (let i = 0; i < results.length; i++) {
                                const result = results[i];
                                const user = this.server.members.find(member => member.id === result.Uuid);
                                reply += `**#${i + 1} ${user ? user : result.Uuid}** - ${minifyBalance(result.Sum)}\n`;
                            }
                        }
                    }
                    msg.reply(embeddedInstance(`__Top 10 players statistics__:`, reply, '00ffef'));
                }
                break;

            case '!pair':
            case '@pair':
                if (messages.length === 1) {
                    const pairs = await this.userInstance.getUserPairs(id);
                    const pair = pairs[0];
                    let reply = `__Server hash__: **${pair.ServerHash}**\n`;
                    reply += `__Client seed__: **${pair.UserSeed}**\n`;
                    msg.reply(embeddedInstance(`Current pair:`, reply, '00ffef'));
                }
                break;
            case '!random':
            case '@random':
                if (messages.length === 1) {
                    const pairs = await this.userInstance.getUserPairs(id);
                    const pair = pairs[0];
                    const result = await this.gamesInstance.voidPair(pair.Id);
                    const newPair = pairs[1];
                    let reply = `__Server hash__: **${newPair.ServerHash}**\n`;
                    reply += `__Client seed__: **${newPair.UserSeed}**\n`;
                    msg.reply(embeddedInstance(`New generated pair:`, reply, '00ffef'));
                }
                break;
            case '!verify':
            case '@verify':
                if (messages.length === 3) {
                    let reply = `__Server seed__: **${messages[1]}**\n`;
                    reply += `__Server hash__: **${generateHash(messages[1], messages[2])}**\n`;
                    reply += `__Client seed__: **${messages[2]}**\n`;
                    reply += `__Result__: **${roll(messages[1], messages[2])}**`;
                    msg.reply(embeddedInstance(`Provably Fair - Result verification:`, reply, '00ffef'));
                }
                break;

            case '!allowed':
            case '@allowed':
                if (messages.length === 1) {
                    const processEnvMaxCashin: any = process.env.DISCORD_CASHIER_MAX_CASHIN;
                    const processEnvMaxCashout: any = process.env.DISCORD_CASHIER_MAX_CASHOUT;
                    let reply = `__Max cash in__: **${processEnvMaxCashin}**\n`;
                    reply += `__Max cash out__: **${processEnvMaxCashout}**`;
                    msg.reply(embeddedInstance(`Cashier allowance`, reply, '00ffef'));
                }
                break;
            case '!44x2':
            case '@44x2':
            case '!54x2':
            case '@54x2':
            case '!75x3':
            case '@75x3':
            case '!92x10':
            case '@92x10':
                if (messages.length === 3) {
                    // const depositRole: Discord.Role = sender.roles.find(role => role.id === process.env.DISCORD_CASHIER_GROUP_ID);
                    const server = messages[2];
                    const amount = messages[1];

                    if (server !== '07' && server !== 'rs3') {
                        msg.reply(embeddedError(`Invalid server.`));
                        return;
                    }

                    if (getAmount(amount) === 0) {
                        msg.reply(embeddedError(`Invalid amount.`));
                        return;
                    }

                    if (!amount.includes('k') && !amount.includes('m') && !amount.includes('b')) {
                        msg.reply(embeddedError(`Invalid currency to use.`));
                        return;
                    }

                    try {
                        const targetUser = await this.userInstance.getUser(id);
                        const osrs = server === '07';
                        const targetBeforeBetBalance = osrs ? targetUser.BalanceOsrs : targetUser.BalanceRs;
                        const amountToDeduce = getAmount(amount) * getMultiplier(amount);
                        if (targetBeforeBetBalance - amountToDeduce < 0) {
                            msg.reply(embeddedError(`Insufficient funds.`));
                            return;
                        }

                        const beforeBetBalance = targetBeforeBetBalance - amountToDeduce;
                        const updateBeforeBet = await this.userInstance.updateUser(id, osrs, beforeBetBalance);

                        let rewardMultiplier = 1;
                        let rewardMinimum = 54;
                        switch (messages[0]) {
                            case '!44x2':
                            case '@44x2':
                                rewardMultiplier = 2;
                                rewardMinimum = 44;
                                break;
                            case '!54x2':
                            case '@54x2':
                                rewardMultiplier = 2;
                                rewardMinimum = 54;
                                break;
                            case '!75x3':
                            case '@75x3':
                                rewardMultiplier = 3;
                                rewardMinimum = 75;
                                break;
                            case '!92x10':
                            case '@92x10':
                                rewardMultiplier = 10;
                                rewardMinimum = 92;
                                break;
                        }

                        const amountToAdd = +amountToDeduce * rewardMultiplier;
                        const pairs = await this.userInstance.getUserPairs(id);
                        const pair = pairs[0];
                        let winBool = false;
                        if (rewardMinimum === 54 || rewardMinimum === 75 || rewardMinimum === 92) {
                            winBool = pair.Result > rewardMinimum;
                        } else {
                            winBool = pair.Result < rewardMinimum;
                        }

                        await this.gamesInstance.addGame(pair.Id, `${+amountToDeduce}`, winBool, getGameType(messages[0]), getServer(osrs));

                        if (winBool) {
                            const user = await this.userInstance.getUser(id);
                            const targetAfterBetBalance = osrs ? user.BalanceOsrs : user.BalanceRs;
                            const newBalance = targetAfterBetBalance + amountToAdd;
                            const updateBalance = await this.userInstance.updateUser(id, osrs, newBalance);
                        }
                        const voidPair = await this.gamesInstance.voidPair(pair.Id);

                        let reply = `__Server seed revealed__: **${pair.ServerSeed}**\n`;
                        reply += `__Server hash__: **${pair.ServerHash}**\n`;
                        reply += `__Client seed__: **${pair.UserSeed}**\n`;
                        reply += `__Result__: **${pair.Result}**\n`;
                        reply += `You have rolled a ${pair.Result}, you have ${winBool ? 'won ' + minifyBalance(+amountToAdd) : 'lost ' + minifyBalance(+amountToDeduce)}!\n`;
                        reply += `To verify the result: !verify **serverSeed** **clientSeed**`;

                        // let sentMessage: any = await msg.reply(embeddedRollimage('https://i.imgur.com/F67CPB8.gif'))
                        // setTimeout(() => {
                        //     sentMessage.edit(embeddedInstance('Game results', reply));
                        // }, 3250);

                        let sentMessage = await msg.reply(embeddedInstance('Game results', reply, '00ff00'));

                    } catch (error) {
                        console.log(error);
                    }
                }
                break;
            case '!transactions':
            case '@transactions':
                if (messages.length === 3) {
                    const server = messages[2];
                    const inOut = messages[2];
                    const depositRole: Discord.Role = msg.member.roles.find(role => role.id === process.env.DISCORD_CASHIER_GROUP_ID);
                    if (server !== '07' && server !== 'rs3') {
                        msg.reply(embeddedError(`Invalid server to view transactions.`));
                        return;
                    }

                    if (inOut !== 'in' && inOut !== 'out') {
                        msg.reply(embeddedError(`Invalid cashing method.`));
                        return;
                    }

                    if (!depositRole) {
                        msg.reply(embeddedError(`You do not have access to view transactions.`));
                        return;
                    }

                    try {
                        const osrs = server === '07';
                        const cashin = inOut === 'in';
                        const txs = await this.txInstance.getTransactions(getServer(osrs), cashin);

                        let reply = '';
                        txs.forEach((tx: any) => {
                            const cashier = this.server.members.find(member => member.id === tx.CashierUuid);
                            const member = this.server.members.find(member => member.id === tx.UserUuid);
                            const verb = tx.CashIn ? 'cashed in' : 'cashed out';
                            reply += `${cashier ? cashier : tx.CashierUuid} ${verb} ${minifyBalance(tx.Amount)} ${tx.Server} for ${member ? member : tx.UserUuid}\n`;
                        });
                        msg.author.send(embeddedInstance(`Last 50 transactions:`, reply));
                    } catch (error) {
                        console.log(error);
                    }
                }
                break;
            default:
                break;
        }
    }
}