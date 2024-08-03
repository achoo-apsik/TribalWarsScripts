(function (TribalWars) {
    let TechnologyEnum = {
        TEN_LEVELS: '0',
        THREE_LEVELS: '1',
        SIMPLE: '2'
    };
    let Settings = {
        simulator_luck: -25, // Hermitowski nigdy nie ma szcz\u{119}\u{15B}cia
        simulator_def_wall: 20,
        simulator_att_troops: {
            axe: 6000,
            light: 3000,
            ram: 242
        },
        back_time_delta: 3 * 3600 * 1000,
        rebuild_time_delta: 48 * 3600 * 1000,
        rebuild_time_threshold: 72 * 3600 * 1000,
        attack_info_lifetime: 14 * 24 * 3600 * 1000,
        deff_units: game_data.units.filter(x => -1 !== ['spear', 'sword', 'archer', 'heavy'].indexOf(x)),
        off_units: game_data.units.filter(x => -1 !== ['axe', 'light', 'marcher', 'ram'].indexOf(x)),
        misc_units: game_data.units.filter(x => -1 !== ['spy', 'catapult', 'snob'].indexOf(x)),
        population: {},
        speed: {},
        build_time: {},
        tech: undefined,
        init: function (worldInfo) {
            const core_build_time = {
                spear: 158.44,
                sword: 233,
                axe: 205.04,
                archer: 279.6,
                spy: 187.1,
                light: 374.2,
                marcher: 561.25,
                heavy: 748.35,
                ram: 1335.3,
                catapult: 2002.9
            };

            this.tech = worldInfo.config.game.tech;

            let world_speed = Number(worldInfo.config.speed);

            for (const unit in worldInfo.unit_info) {
                this.population[unit] = Number(worldInfo.unit_info[unit].pop);
                this.speed[unit] = Number(worldInfo.unit_info[unit].speed);
                if (core_build_time[unit]) {
                    this.build_time[unit] = core_build_time[unit] / world_speed;
                }
            }
        }
    };
    let Helper = {
        parse_datetime_string: function (datetime_string) {
            let date_time = datetime_string.split(' ');
            let date = date_time[0].split('.').map(x => Number(x));
            let time = date_time[1].split(':').map(x => Number(x));
            return new Date(2000 + date[2], date[1] - 1, date[0], time[0], time[1], time[2]);
        },
        date_to_datetime_string: function (date) {
            let two_digit_function = function (number) {
                return number < 10
                    ? `0${number}`
                    : `${number}`;
            };
            let days = two_digit_function(date.getDate());
            let month = two_digit_function(date.getMonth() + 1);
            let year = two_digit_function(date.getFullYear() % 100);
            let hours = two_digit_function(date.getHours());
            let minutes = two_digit_function(date.getMinutes());
            let seconds = two_digit_function(date.getSeconds());
            return `${days}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        },
        calculate_rebuild_time: function (troops) {
            let rebuild_time = function (units) {
                return units
                    .filter(unit => troops[unit] > 0)
                    .reduce((time, unit) => Settings.build_time[unit] * troops[unit] + time, 0) * 1000;
            }

            let barracks_time = rebuild_time(['spear', 'sword', 'axe', 'archer']);
            let stable_time = rebuild_time(['spy', 'light', 'marcher', 'heavy']);
            let garage_time = rebuild_time(['ram', 'catapult']);
            return Math.max(barracks_time, stable_time, garage_time);
        },
        get_troops_summary: function (troops) {
            function count_population(units) {
                return units.reduce((time, unit) => Settings.population[unit] * troops[unit] + time, 0);
            }

            let deff_population = count_population(Settings.deff_units);
            let off_population = count_population(Settings.off_units);
            let misc_population = count_population(Settings.misc_units);
            return {
                troops: troops,
                deff_population: deff_population,
                off_population: off_population,
                misc_population: misc_population,
            }
        },
        generate_link_to_simulator: function (def_troops) {
            let properties = {
                mode: 'sim',
                moral: 100,
                luck: Settings.simulator_luck,
                belief_def: 'on',
                belief_att: 'on',
                simulate: 1,
                def_wall: Settings.simulator_def_wall
            };

            let append_units = function (context, units) {
                for (const unit in units) {
                    if (units[unit] > 0) {
                        properties[`${context}_${unit}`] = units[unit];
                        switch (Settings.tech) {
                            case TechnologyEnum.TEN_LEVELS:
                                properties[`${context}_tech_${unit}`] = 10;
                                break;
                            case TechnologyEnum.THREE_LEVELS:
                                properties[`${context}_tech_${unit}`] = 3;
                                break;
                        }

                    }
                }
            }

            append_units('att', Settings.simulator_att_troops);
            append_units('def', def_troops);

            return TribalWars.buildURL('GET', 'place', properties).substr(1);
        },
        get_march_time: function (troops, origin, destination) {
            let march_time_per_field = Object.keys(troops).filter(unit => troops[unit] > 0)
                .reduce((time_per_field, unit) => Math.max(Settings.speed[unit], time_per_field), 0);
            if (march_time_per_field === 0) {
                throw 'xd';
            }
            let distance = Math.hypot(origin[0] - destination[0], origin[1] - destination[1]);
            return Math.round(distance * march_time_per_field * 60) * 1000;
        },
        beautify_number: function (number) {
            if (number < 1000) {
                return `${number}`;
            }
            number /= 1000;
            let precision = 0;
            if (number < 100) {
                precision = 1;
            }
            if (number < 10) {
                precision = 2;
            }
            return `${number.toFixed(precision)}K`;
        },
        get_troops_by_row: function (row, start) {
            let troops = {};
            for (let i = start; i < row.cells.length; i++) {
                let count = Number(row.cells[i].innerText);
                troops[game_data.units[i - start]] = count;
            }
            return troops;
        },
        handle_error: function (error) {
            if (typeof (error) === 'string') {
                UI.ErrorMessage(error);
                return;
            }
            const gui =
                `<h2>WTF - What a Terrible Failure</h2>
                 <p><strong>Komunikat o b\u{142}\u{119}dzie: </strong><br/>
                    <textarea rows='5' cols='42'>${error}\n\n${error.stack}</textarea><br/>
                    <a href='https://forum.plemiona.pl/index.php?threads/hermitowskie-notatki.126752/'>Link do w\u{105}tku na forum</a>
                 </p>`;
            Dialog.show(namespace, gui);
        }
    };
    let NotesScript = {
        context: {},
        village_info: {},
        attack_info: {},
        init: function () {
            try {
                NotesScript.check_screen();
                NotesScript.get_report_id();
                NotesScript.get_battle_time();
                NotesScript.get_context();
                NotesScript.get_village_coords();
                if (NotesScript.context.side === 'att') {
                    NotesScript.get_church();
                    NotesScript.get_attack_results();
                    NotesScript.check_if_is_empty();
                    NotesScript.get_sim();
                    NotesScript.get_units_away();
                }
                if (NotesScript.context.side === 'def') {
                    NotesScript.get_back_time();
                }
                NotesScript.get_export_code();
                NotesScript.get_rebuild_time();
                NotesScript.get_belief();
                NotesScript.get_troops_type();
                NotesScript.check_report();
                NotesScript.get_current_notes().then(old_notes => {
                    try {
                        let new_note = NotesScript.parse_notebook(old_notes);
                        if (new_note.error) {
                            throw new_note.error;
                        }
                        NotesScript.add_note(new_note);
                    } catch (e) {
                        UI.ErrorMessage(e);
                        console.error(e);
                    }
                });
            }
            catch (e) {
                if (typeof (e) === 'string') {
                    UI.ErrorMessage(e);
                } else {
                    const gui =
                        `<h2>WTF - What a Terrible Failure</h2>
                        <p><strong>Komunikat o b\u{142}\u{119}dzie: </strong><br/>
                            <textarea rows='5' cols='42'>${e}\n\n${e.stack}</textarea><br/>
                            <a href='https://forum.plemiona.pl/index.php?threads/hermitowskie-notatki.126752/'>Link do w\u{105}tku na forum</a>
                        </p>`;
                    Dialog.show(namespace, gui);
                }
            }
        },
        check_screen: function () {
            if (game_data.screen !== 'report') {
                throw 'Nie jestes na ekranie raportu!';
            }
        },
        get_report_id: function () {
            NotesScript.context.report_id = window.location.href.match(/view=(\d+)/)[1];
        },
        get_battle_time: function () {
            let element = $('#attack_info_att > tbody > tr:nth-child(2) > td:nth-child(2)');
            NotesScript.context.battle_time = Helper.parse_datetime_string(element.text());
        },
        get_context: function () {
            if (game_data.player.name === $('#attack_info_att > tbody > tr:nth-child(1) > th > a').text()) {
                NotesScript.context.side = 'att';
                NotesScript.context.other_side = 'def';
            } else {
                NotesScript.context.side = 'def';
                NotesScript.context.other_side = 'att';
            }
        },
        get_village_coords: function () {
            let coords_string = $(`#attack_info_${NotesScript.context.other_side} .village_anchor`).text().match(/\d+\|\d+/)[0];
            NotesScript.context.village_coords = coords_string.split('|').map(x => Number(x));
        },
        get_church: function () {
            NotesScript.context.church = Boolean($('#attack_info_def tbody img[src*="church"]').length);
        },
        get_attack_results: function () {
            let attack_result_elements = $(`#attack_info_${NotesScript.context.side} + table td`);

            NotesScript.context.attack_results = game_data.units.reduce((results, unit, index) => {
                results[unit] = Number(attack_result_elements[index].innerText);
                return results;
            }, {});
        },
        check_if_is_empty: function () {
            NotesScript.context.is_empty = !$('#attack_info_def tbody img[src*="unit"]').length;
        },
        get_sim: function () {
            let link = Helper.generate_link_to_simulator(NotesScript.context.attack_results);
            NotesScript.context.sim = link;
        },
        get_units_away: function () {
            let away_rows = $('#attack_info_def tbody img[src*="unit_knight"]').parents('table').find('tr');
            if (away_rows.length > 1) {
                NotesScript.context.units_away = Helper.get_troops_by_row(away_rows[1], 1);
            } else {
                NotesScript.context.units_away = {};
            }
        },
        get_back_time: function () {
            let attack_time = Helper.parse_datetime_string($('#attack_info_att tbody td:nth-child(2)').text());
            NotesScript.context.back_time = new Date(attack_time.getTime() + Settings.back_time_delta);
        },
        get_export_code: function () {
            NotesScript.context.export_code = $('#report_export_code').text();
        },
        get_rebuild_time: function () {
            NotesScript.context.rebuild_time = Helper.calculate_rebuild_time(NotesScript.context.attack_results);
        },
        get_belief: function () {
            NotesScript.context.belief = Boolean($('#attack_info_att tbody img[src*="faith"]').length);
        },
        get_troops_type: function () {
            let units = NotesScript.context.attack_results;
            NotesScript.context.troops_type = units.spear || units.sword || units.archer || units.heavy ? 'def' : 'off';
        },
        check_report: function () {
            if (!NotesScript.context.report_id) {
                throw 'Raport nie posiada identyfikatora!';
            }
            if (!NotesScript.context.battle_time) {
                throw 'Raport nie zawiera czasu bitwy!';
            }
            if (!NotesScript.context.village_coords) {
                throw 'Raport nie zawiera wspolrzednych wioski!';
            }
            if (!NotesScript.context.export_code) {
                throw 'Raport nie zawiera kodu eksportu!';
            }
        },
        get_current_notes: async function () {
            let player_id = game_data.player.id;
            let notes_response = await fetch(`/game.php?screen=info_player&id=${player_id}`);
            let notes_text = await notes_response.text();
            let notes_element = $(notes_text).find('#player_notes');
            if (notes_element.length === 0) {
                throw 'Nie mozna pobrac notatek!';
            }
            return notes_element.text();
        },
        parse_notebook: function (old_notes) {
            let village_info = NotesScript.context.village_coords.join('|');
            let new_note = NotesScript.context.export_code + ` [${NotesScript.context.report_id}]`;
            let search_for = new RegExp(`\\[${NotesScript.context.report_id}\\]`, 'g');
            let exists = search_for.test(old_notes);
            let result = {
                exists: exists,
                error: undefined,
                village_info: village_info
            };

            if (!exists) {
                let now = new Date().getTime();
                let new_notes = old_notes + `${new_note} [${now}]`;
                result.new_notes = new_notes;
            }

            return result;
        },
        add_note: async function (new_note) {
            if (!new_note.exists) {
                await fetch(`/game.php?village=${game_data.village.id}&screen=info_player`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `description=${encodeURIComponent(new_note.new_notes)}`
                });
                location.reload();
            }
        }
    };

    Settings.init(window.TribalWars);
    NotesScript.init();
})(window.TribalWars);
