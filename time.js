/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, curly:true, devel:true, indent:4, maxerr:50, expr:true, onevar:true, browser:true, node:true */

!function (exports) {
    'use strict';

    if (!exports) {
        // This feature is not supported in the current environment.
        return;
    }

    var defaultUnits = {
            ms: 'ms',
            second: 'a second',
            seconds: 'seconds',
            minute: 'a minute',
            minutes: 'minutes',
            hour: 'an hour',
            hours: 'hours',
            day: 'a day',
            days: 'days',
            week: 'a week',
            weeks: 'weeks'
        },
        c1000 = 1000,
        c60000 = 60000,
        c3600000 = 3600000,
        c86400000 = 86400000,
        c604800000 = 604800000;

    exports.humanize = function (v, units) {
        units = units || defaultUnits;

        if (v < c1000) {
            return Math.round(v) + ' ' + units.ms;
        } else if (v === c1000) {
            return units.second;
        } else if (v < c60000) {
            return toFixed(v / c1000, 1) + ' ' + units.seconds;
        } else if (v === c60000) {
            return units.minute;
        } else if (v < c3600000) {
            return toFixed(v / c60000, 1) + ' ' + units.minutes;
        } else if (v === c3600000) {
            return units.hour;
        } else if (v < c86400000) {
            return toFixed(v / c3600000, 1) + ' ' + units.hours;
        } else if (v === c86400000) {
            return units.day;
        } else if (v < c604800000) {
            return toFixed(v / c86400000, 1) + ' ' + units.days;
        } else if (v === c604800000) {
            return units.week;
        } else {
            return toFixed(v / c604800000, 1) + ' ' + units.weeks;
        }
    };

    function toFixed(value, decimals) {
        // The original toFixed() provided in JS always return 1 decimal places.
        // We want to remove decimal places if the value is an integer for readability.

        if (value % 1 === 0) {
            return value + '';
        } else {
            return value.toFixed(decimals);
        }
    }
}(
    typeof window !== 'undefined' ? (window.ztom = window.ztom || {}).time = {} :
    typeof module !== 'undefined' ? module.exports :
    null);