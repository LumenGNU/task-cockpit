import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import Configuration from 'src/Configuration';


// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });

    suite('createSchema', function () {

        test(`${/*++N*/'001'/**/} пустая схема — нормальное создание схемы`, function () {
            assert.doesNotThrow(() => {
                Configuration.createSchema<{}>({});
            });
        });

        test(`${/*++N*/'002'/**/} значение true (не объект) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>(
                    { anyKey: true }
                );
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'003'/**/} значение false (не объект) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>(
                    { anyKey: false }
                );
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'004'/**/} значение undefined — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>(
                    { anyKey: undefined }
                );
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'005'/**/} значение [] (массив) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>({
                    anyKey: []
                });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'006'/**/} значение {} — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>({
                    anyKey: {}
                });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'007'/**/} пустой configKey — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>({
                    anyKey: Configuration.BooleanSpec({
                        configKey: '',
                        fallback: false
                    })
                });
            }, /Empty configKey/);
        });


        suite('String', function () {

            test(`${/*++N*/'008'/**/} фолбек не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringSpec({
                            configKey: 'anyPath',
                            fallback: '127.0.0.0',
                            pattern: /^\d+$/
                        })
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'009'/**/} фолбек (пустая строка) не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringSpec({
                            configKey: 'anyPath',
                            fallback: '',
                            pattern: /^\d+$/
                        })
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'010'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKeyStr: Configuration.StringSpec({
                            configKey: 'anyPath',
                            // @ts-expect-error /* ts видит здесь ошибку */
                            fallback: 42
                        })
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'011'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {
                    Configuration.createSchema<{}>({
                        anyKeyStr: Configuration.StringSpec({
                            configKey: 'anyPath',
                            fallback: '42',
                            pattern: /42/
                        })
                    });

                });
            });

        });

        suite('Number', function () {

            test(`${/*++N*/'012'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKeyNumb: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            // @ts-expect-error /* ts видит здесь ошибку */
                            fallback: '42'
                        })
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'013'/**/} fallback меньше min — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            min: 0,
                            fallback: -1
                        })
                    });
                }, /Fallback \(-?\d+\) is less than min/);
            });

            test(`${/*++N*/'014'/**/} fallback равно min — схема создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            min: 0,
                            fallback: 0
                        })
                    });
                });
            });

            test(`${/*++N*/'015'/**/} fallback больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            max: 0,
                            fallback: 1
                        })
                    });
                }, /Fallback \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'016'/**/} fallback равно max — схема создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            max: 1,
                            fallback: 1
                        })
                    });
                });
            });

            test(`${/*++N*/'017'/**/} min больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            min: 1,
                            fallback: 0,
                            max: -1
                        })
                    });
                }, /Min \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'018'/**/} fallback равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            fallback: Infinity
                        })
                    });
                }, /Invalid fallback value/);
            });


            test(`${/*++N*/'019'/**/} min равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            min: Infinity,
                            fallback: 0
                        })
                    });
                }, /Min is not a finite number/);
            });


            test(`${/*++N*/'020'/**/} max равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            max: Infinity,
                            fallback: 0
                        })
                    });
                }, /Max is not a finite number/);
            });


            test(`${/*++N*/'021'/**/} fallback равен NaN — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            fallback: NaN
                        })
                    });
                }, /Invalid fallback/);
            });


            test(`${/*++N*/'022'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    Configuration.createSchema<{}>({
                        anyKeyNum: Configuration.NumberSpec({
                            configKey: 'anyPath',
                            min: 42,
                            fallback: 42,
                            max: 42
                        })
                    });

                });
            });

        });

        suite('Boolean', function () {

            test(`${/*++N*/'023'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKeyBool: Configuration.BooleanSpec({
                            configKey: 'anyPath',
                            // @ts-expect-error /* ts видит здесь ошибку */
                            fallback: []
                        })
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'024'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    Configuration.createSchema<{}>({
                        anyKeyBool: Configuration.BooleanSpec({
                            configKey: 'anyPath',
                            fallback: true
                        })
                    });

                });
            });

        });

        suite('StringSet', function () {

            test(`${/*++N*/'025'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKeySet: Configuration.StringSetSpec({
                            configKey: 'anyPath',
                            // @ts-expect-error /* ts видит здесь ошибку */
                            fallback: true
                        })
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'026'/**/} fallback содержит не строки — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKeySet: Configuration.StringSetSpec({
                            configKey: 'anyPath',
                            // @ts-expect-error /* ts видит здесь ошибку */
                            fallback: ['41', 42, '43']
                        })
                    });
                }, /Invalid fallback item/);

            });

            test(`${/*++N*/'027'/**/} fallback пустой массив — нормально создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringSetSpec({
                            configKey: 'anyPath',
                            fallback: []
                        })
                    });
                });
            });

            test(`${/*++N*/'028'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {
                    Configuration.createSchema<{ anyKeySet: Set<string>; }>({
                        anyKeySet: Configuration.StringSetSpec({
                            configKey: 'anyPath',
                            fallback: ['fallback']
                        })
                    });
                });
            });

        });

        suite('StringLiteral', function () {

            test(`${/*++N*/'029'/**/} values не массив — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringLiteralSpec({
                            configKey: 'anyPath',
                            // @ts-expect-error
                            values: 'not-an-array',
                            fallback: 'a'
                        })
                    });
                }, /Invalid values/);
            });

            test(`${/*++N*/'030'/**/} values содержит пустую строку — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringLiteralSpec({
                            configKey: 'anyPath',
                            values: ['a', ''],
                            fallback: 'a'
                        })
                    });
                }, /Invalid literal value/);
            });

            test(`${/*++N*/'031'/**/} values содержит не-строку — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringLiteralSpec({
                            configKey: 'anyPath',
                            // @ts-expect-error
                            values: ['a', 42],
                            fallback: 'a'
                        })
                    });
                }, /Invalid literal value/);
            });

            test(`${/*++N*/'032'/**/} fallback не строка — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringLiteralSpec({
                            configKey: 'anyPath',
                            values: ['a', 'b'],
                            // @ts-expect-error
                            fallback: 42
                        })
                    });
                }, /Invalid fallback type/);
            });

            test(`${/*++N*/'033'/**/} fallback не входит в values — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringLiteralSpec({
                            configKey: 'anyPath',
                            values: ['a', 'b'],
                            fallback: 'c'
                        })
                    });
                }, /is not included in values/);
            });

            test(`${/*++N*/'034'/**/} валидная схема — нормально создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{}>({
                        anyKey: Configuration.StringLiteralSpec({
                            configKey: 'anyPath',
                            values: ['a', 'b'],
                            fallback: 'a'
                        })
                    });
                });
            });

        });
    });
});
