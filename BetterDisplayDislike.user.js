// ==UserScript==
// @name         Better Display Dislike
// @version      1.0.0
// @description  Displays ratings on all videos no matter what
// @author       Aubrey P.
// @namespace    aubymori
// @icon         https://www.youtube.com/favicon.ico
// @license      Unlicense
// @match        www.youtube.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

console.log("Dislike stats from the Return YouTube Dislike API https://returnyoutubedislike.com/");

const bddOptions = {};

/**
 * Localization strings.
 */
const bddi18n = {
    en: {
        la11ySingular: "1 like",
        la11yPlural: "%s likes",
        la11yLblSingular: "like this video along with 1 other person",
        la11yLblPlural: "like this video along with %s other people",
        da11ySingular: "1 dislike",
        da11yPlural: "%s dislikes",
        da11yLblSingular: "dislike this video along with 1 other person",
        da11yLblPlural: "dislike this video along with %s other people",
        sentimentTooltip: "%l / %d",
        extractLikeCount: /( likes)|( like)|(,)/g
    }
};

/**
 * Get a string from the localization strings.
 *
 * @param {string} string  Name of string to get
 * @param {string} hl      Language to use.
 * @returns {string}
 */
function getString(string, hl = "en") {
    if (!string) return "ERROR";
    if (bddi18n[hl]) {
        if (bddi18n[hl][string]) {
            return bddi18n[hl][string];
        } else if (bdd18n.en[string]) {
            return bddi18n.en[string];
        } else {
            return "ERROR";
        }
    } else {
        if (bddi18n.en[string]) return bddi18n.en[string];
        return "ERROR";
    }
}

/**
 * Abbreviate a number to YouTube's format
 * 
 * @param {number} num  Number to abbreviate.
 * @param {string} hl   Language for formatting
 * @param {string} gl   Country for formatting
 * @returns {string}
 */
function abbrNum(num, hl, gl) {
    if (Number.isNaN(+num)) return "";
    if (num < 1000) return ""+num;
    var num = ""+num;
    num = num.substr(0, 3) * 10 ** (num.length - 3);
    return new Intl.NumberFormat(hl + "-" + gl, {
        notation: "compact",
        maximumFractionDigits: 2
    }).format(num);
}

/**
 * Get the like and dislike counts of the current video.
 * 
 * @returns {object}
 */
async function getCounts() {
    const primaryInfo = document.querySelector("ytd-video-primary-info-renderer");
    const topLevelButtons = primaryInfo.data.videoActions.menuRenderer.topLevelButtons;
    const likeButton = topLevelButtons[0].toggleButtonRenderer;
    const videoId = new URLSearchParams(window.location.search).get("v");
    const language = yt.config_.HL ?? "en";
    var response = {};

    var likeCount = likeButton.accessibility.label.replace(getString("extractLikeCount", language), "");
    if (!Number.isNaN(Number(likeCount))) response.likes = Number(likeCount);

    var rydData = fetch("https://returnyoutubedislikeapi.com/votes?videoId=" + videoId);
    rydData = await (await rydData).json();

    if (!response.likes) {
        response.likes = rydData.likes
    }
    response.dislikes = rydData.dislikes;

    return response;
}

/**
 * Get label data for a vote count.
 * 
 * @param {number}  count  Vote count
 * @param {boolean} isDl   Is it dislikes?
 * @param {string}  hl     Language
 * @param {string}  gl     Country
 * @returns {object}
 */
function getLabel(count, isDl, hl = "en", gl = "US") {
    var response = {};
    var prefix = isDl ? "d" : "l";

    response.simpleText = abbrNum(count, hl, gl);

    var a11y;
    if (count == 1) {
        a11y = getString(prefix + "a11ySingular", hl);
    } else {
        a11y = getString(prefix + "a11yPlural", hl).replace("%s", count.toLocaleString(hl + "-" + gl));
    }

    response.accessibility = {
        label: a11y
    };

    return response;
}

/**
 * Get accessibility data for a vote count.
 * 
 * @param {number}  count  Vote count
 * @param {boolean} isDl   Is it dislikes?
 * @param {string}  hl     Language
 * @param {string}  gl     Country
 * @returns {object}
 */
function getA11yData(count, isDl, hl = "en", gl = "US") {
    var response = {
        accessibilityData: {}
    }
    var prefix = isDl ? "d" : "l";

    if (count == 1) {
        response.accessibilityData.label = getString(prefix + "a11yLblSingular", hl);
    } else {
        response.accessibilityData.label = getString(prefix + "a11yLblPlural", hl).replace("%s", count.toLocaleString(hl + "-" + gl));
    }
}

/**
 * Calculate sentiment percentage.
 * 
 * @param {number} likes      Like count
 * @param {number} dislikes   Dislike count
 * @returns {string}
 */
function calculateSentiment(likes, dislikes) {
    return ""+(likes / (likes + dislikes)) * 100;
}

/**
 * Build sentiment bar data.
 * 
 * @param {string} likes     Like count.
 * @param {string} dislikes  Dislike count. 
 * @param {string} hl        Language.
 * @param {string} gl        Country.
 * @returns {object}
 */
function buildSentiment(likes, dislikes, status, hl = "en", gl = "en") {
    return {
        "sentimentBarRenderer": {
            "percentIfIndifferent": (likes == 0 && dislikes == 0) ? "50" : calculateSentiment(likes, dislikes),
            "percentIfLiked": (likes == 0 && dislikes == 0) ? "100" : calculateSentiment(likes + 1, dislikes),
            "percentIfDisliked": (likes == 0 && dislikes == 0) ? "0" : calculateSentiment(likes, dislikes + 1),
            "likeStatus": status,
            "tooltip": getString("sentimentTooltip", hl).replace("%l", likes.toLocaleString(hl + "-" + gl)).replace("%d", dislikes.toLocaleString(hl + "-" + gl))
        }
    }
}

/**
 * Update counts and sentiment bars.
 * 
 * @returns {void}
 */
async function updateCounts() {
    console.log('hi');

    const primaryInfo = document.querySelector("ytd-video-primary-info-renderer");
    const topLevelButtons = primaryInfo.data.videoActions.menuRenderer.topLevelButtons;
    const likeButton = topLevelButtons[0].toggleButtonRenderer;
    const dislikeButton = topLevelButtons[1].toggleButtonRenderer;
    const likeStatus = (() => {
        if (likeButton.isToggled) {
            return "LIKE";
        } else if (dislikeButton.isToggled) {
            return "DISLIKE";
        } else {
            return "INDIFFERENT";
        }
    })();
    const counts = await getCounts();
    const language = yt.config_.HL ?? "en";
    const country = yt.config_.GL ?? "US";

    console.log(counts);

    // If like button is pressed
    if (likeButton.isToggled) {
        likeButton.defaultText = getLabel(counts.likes - 1, false, language, country);
        likeButton.toggledText = getLabel(counts.likes, false, language, country);
    } else {
        likeButton.defaultText = getLabel(counts.likes, false, language, country);
        likeButton.toggledText = getLabel(counts.likes + 1, false, language, country);
    }

    likeButton.accessibilityData = getA11yData(counts.likes, false, language, country);

    // If dislike button is pressed
    if (dislikeButton.isToggled) {
        dislikeButton.defaultText = getLabel(counts.dislikes - 1, true, language, country);
        dislikeButton.toggledText = getLabel(counts.dislikes, true, language, country);
    } else {
        dislikeButton.defaultText = getLabel(counts.dislikes, true, language, country);
        dislikeButton.toggledText = getLabel(counts.dislikes + 1, true, language, country);
    }

    dislikeButton.accessibilityData = getA11yData(counts.dislikes, true, language, country);

    var sentimentBar = buildSentiment(counts.likes, counts.dislikes, likeStatus, language, country)
    primaryInfo.data.sentimentBar = sentimentBar;

    // Let Polymer know data has been changed and make it act accordingly
    var tmpData = primaryInfo.data;
    primaryInfo.data = {};
    primaryInfo.data = tmpData;
}

document.addEventListener("yt-page-data-updated", e => {
    if (e.detail.pageType == "watch") {
        updateCounts();
    }
});