'use strict';

// Packages
const equal = require('deep-equal');
const numeral = require('numeral');
const request = require('request-promise');
const BB = require('bluebird');
const Pusher = require('pusher-js');

// Ours
const nodecg = require('./util/nodecg-api-context').get();

const currentBidsRep = nodecg.Replicant('currentBids', {defaultValue: []});
const allBidsRep = nodecg.Replicant('allBids', {defaultValue: []});
const bitsTotal = nodecg.Replicant('bits:total', {defaultValue: 0});
const tiltifyBids = nodecg.Replicant('tiltifyDonations', {defaultValue: []})
const moneyTotal = nodecg.Replicant('total', {defaultValue: {
    raw: 0,
    formatted: "0"
}});

const tiltifyApiKey = "c0b88d914287a2f4ee32";
const tiltifyCluster = "mt1";
const tiltifyEventID = "19861";//16747

const tiltifyWebApiKey = nodecg.bundleConfig.tiltifyWebApiKey;

var tiltifyPusher = new Pusher(tiltifyApiKey, {cluster: tiltifyCluster});
var channel = tiltifyPusher.subscribe("campaign."+tiltifyEventID);

/**
 * Updated the total donation abount right from the tiltify api
 */
function updateCampaign() {
    request(
        {uri: "https://tiltify.com/api/v3/campaigns/"+tiltifyEventID,
        json: true,
        headers: {"Authorization":"Bearer "+tiltifyWebApiKey}})
      .then(rawJson => {
          nodecg.log.info(rawJson.data.amountRaised);
          _processRawCampain(rawJson);
      })
      .error(err => {
          nodecg.log.error("Something went wrong: "+err);
      })
}

/**
 * Updates challenges, aka donation incentives
 */
function updateChallenges() {
    request(
        {uri: "https://tiltify.com/api/v3/campaigns/"+tiltifyEventID+"/challenges",
        json: true,
        headers: {"Authorization":"Bearer "+tiltifyWebApiKey}})
        .then(rawJson => {
            // example:{"meta":{"status":200},"data":[{"id":2162,"type":"Challenge","name":"Delete the \"Worlds Sexiest Warlock\" Challenge ","totalAmountRaised":10.0,"amount":4947.0,"campaignId":16747,"active":true,"endsAt":1529474400000,"createdAt":1529453219000,"updatedAt":1529453319000}]}
            var allChallenges = [];
            var challenge;
            for (var i in rawJson.data) {
                challenge = rawJson.data[i];
                var formattedChallenge = {
                    id: challenge.id,
                    type: "challenge",
                    name: "test",
                    description: challenge.name,
                    total: numeral(challenge.totalAmountRaised).format('$0,0[.]00'),
                    rawTotal: parseFloat(challenge.totalAmountRaised),
                    speedrun: "speed run",
                    speedrunEndtime: Date.parse(challenge.endsAt),
                    public: true,
                    isBitsChallenge: false
                };
                formattedChallenge.goal = numeral(challenge.amount).format('0,0');
                formattedChallenge.rawGoal = parseFloat(challenge.amount);
                formattedChallenge.goalMet = formattedChallenge.rawTotal >= formattedChallenge.rawGoal;
                formattedChallenge.state = formattedChallenge.goalMet ? 'CLOSED' : 'OPENED';
                allChallenges.push(formattedChallenge);
            }
            allChallenges.sort((a,b) =>  a.speedrunEndtime > b.speedrunEndtime);
            //if (allBidsRep.value != allChallenges) {
            //    allBidsRep.value = allChallenges;
            //}
            if (currentBidsRep.value != allChallenges) {
                currentBidsRep.value = allChallenges;
            }
            nodecg.log.info(JSON.stringify(allChallenges));
      })
      .error(err => {
          nodecg.log.error("Something went wrong: "+err);
      })
}

function update() {
    updateCampaign();
    updateChallenges();
}

update();

/*function fakeDonation() {
    moneyTotal.value = {
        raw: moneyTotal.value.raw + 20,
        formatted: (moneyTotal.value.raw + 20).toString(),
    }
}

setInterval(fakeDonation, 1000);*/

// Datamodels

/*campain:{"type":"campaign","data":
   {"id":12478,"name":"Kirbython2018","slug":"kirbython2018","startsAt":1541030400000,"endsAt":1541462400000,"description":"",
   "causeId":65,"originalFundraiserGoal":10000,"fundraiserGoalAmount":10000,"supportingAmountRaised":0,"amountRaised":4017.82,
   "supportable":false,"status":"published","type":"Event","avatar":{"src":"https://tiltify-production-assets.s3.us-west-2.amazonaws.com/uploads/cause/avatar/65/image001.png","alt":"","width":200,"height":200},
   "livestream":{"type":"twitch","channel":"kirbythons"},"totalAmountRaised":4017.82,"user":
     {"id":21764,"username":"Copperdragon","slug":"copperdragon","url":"https://tiltify.com/@copperdragon",
     "avatar":{"src":"/assets/default-avatar-5d89b08b793f205b5fe1d94ae58b00c6449b8b234666f2a29545d5a5cb3d981a.jpg","alt":"","width":200,"height":200}}
    }
  }*/

/* donation:{"type":"donation","data":{"id":797454,"amount":1,"name":"Mahboison","comment":"First try!",
"completedAt":1541438000000,"pollOptionId":3495,"sustained":false}}*/

function _processRawCampain(rawData) {
    console.log('campain:' + JSON.stringify(rawData));
    moneyTotal.value = {
        raw: rawData.data.amountRaised,
        formatted: (rawData.data.amountRaised).toString()
    }
}

function _processRawDonation(rawData) {
    console.log('donation:' + JSON.stringify(rawData));
}

channel.bind('campaign', _processRawCampain);

channel.bind('donation', _processRawDonation);