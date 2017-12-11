#!/usr/bin/env node

const path = require( 'path' );
const fs = require( 'fs' );

const got = require( 'got' );
const Table = require( 'cli-table-redemption' );
const timeago = require( 'timeago.js' );
const userHome = require( 'user-home' );
const readlineSync = require( 'readline-sync' );
const isUrl = require( 'is-url' );
const chalk = require( 'chalk' );

const argv = require( 'minimist' )( process.argv.slice( 2 ) );

const CONFIG_FILENAME = 'snet-locator-settings.json';
const PATH_TO_CONFIG = path.join( userHome, CONFIG_FILENAME );
let settings;

const getMatchPattern = function getMatchPattern( stringToFind ) {
    let matchPattern = stringToFind.toLowerCase();

    matchPattern = matchPattern.replace( ' ', '[\\s\\.\\-]' );

    return new RegExp( matchPattern, 'gim' );
};

const isInString = function isInString( haystackString, needleString ) {
    return haystackString.match( getMatchPattern( needleString ) );
};

const getSightings = function getSightings() {
    const who = argv[ '_' ].join( ' ' );

    got( settings.locatorDataPath, {
        json: true
    } )
        .then( ( locatorResponse ) => {
            const locatorData = locatorResponse.body;
            const table = new Table( {
                head: [
                    'Who',
                    'When',
                    'What',
                    'Where',
                ],
            } );

            const sightings = [];

            for ( let i = 0; i < locatorData.length; i = i + 1 ) {
                if ( isInString( locatorData[ i ].fullName, who ) ) {
                    sightings.push( [
                        locatorData[ i ].fullName,
                        locatorData[ i ].lastSeen,
                        `${ locatorData[ i ].hostName } (${ locatorData[ i ].deviceType } - ${ locatorData[ i ].os })`,
                        `${ locatorData[ i ].location } - ${ locatorData[ i ].locationFine }`,
                    ] )
                }
            }

            if ( sightings.length < 1 ) {
                for ( let i = 0; i < locatorData.length; i = i + 1 ) {
                    if ( isInString( locatorData[ i ].hostName, who ) ) {
                        sightings.push( [
                            locatorData[ i ].fullName,
                            locatorData[ i ].lastSeen,
                            `${ locatorData[ i ].hostName } (${ locatorData[ i ].deviceType } - ${ locatorData[ i ].os })`,
                            `${ locatorData[ i ].location } - ${ locatorData[ i ].locationFine }`,
                        ] )
                    }
                }
            }

            sightings.sort( ( a, b ) => {
                let aTime = new Date( a[ 1 ] ).getTime();
                let bTime = new Date( b[ 1 ] ).getTime();

                if ( aTime > bTime ) {
                    return -1;
                }

                if ( aTime < bTime ) {
                    return 1;
                }

                return 0;
            } );

            table.push( ...sightings.map( ( sightingData ) => {
                sightingData[ 1 ] = timeago().format( sightingData[ 1 ] );

                return sightingData;
            } ) );

            if ( sightings.length > 0 ) {
                console.log( table.toString() );
            } else {
                console.log( chalk.yellow( `Couldn't find anyone matching "${ who }"` ) );
            }
        } )
        .catch( ( loadError ) => {
            if ( loadError.code === 'ENOTFOUND' ) {
                console.error( chalk.red( `Failed to load ${ chalk.inverse( settings.locatorDataPath ) }\nAre you it's accessible?` ) );
            } else {
                console.error( chalk.red( `Failed to load ${ chalk.inverse( settings.locatorDataPath ) }\nAre you sure it's correct?\nPlease edit ${ chalk.underline( PATH_TO_CONFIG ) } and fix it.` ) );
            }
        } );
};

const writeConfig = function writeConfig () {
    fs.writeFile( PATH_TO_CONFIG, JSON.stringify( settings, null, 4 ), ( writeError ) => {
        if ( writeError ) {
            throw writeError;
        }

        getSightings();
    } );
};

const loadConfig = function loadConfig ( betterQuestion ) {
    fs.readFile( PATH_TO_CONFIG, ( readError, fileData ) => {
        if ( readError ) {
            let question = betterQuestion || `Unable to get path to locator data. Plizz gimme `;

            settings = {};
            settings.locatorDataPath = readlineSync.question( question );

            if ( isUrl( settings.locatorDataPath ) ) {
                writeConfig();
            } else {
                if ( settings.locatorDataPath === 'no' || settings.locatorDataPath === 'n' ) {
                    console.log( `Really? Sure, your move then. ` );
                    process.exit();
                } else {
                    loadConfig( `Yeah... If you'd just give me an url that'd be great... ` );
                }
            }
        } else {
            settings = JSON.parse( fileData );
            getSightings();
        }
    } );
};

loadConfig();
