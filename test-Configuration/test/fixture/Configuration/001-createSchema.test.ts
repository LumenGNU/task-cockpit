import * as assert from 'assert/strict';

import {
    Configuration,
    OptionType
} from 'src/Configuration/Configuration';


// `${/*N=0*/'000'/**/}`

suite('Configuration', function () {

    suite('createSchema', function () {

        test(`${/*++N*/'001'/**/} пустая схема — нормально создание схемы`, function () {
            assert.doesNotThrow(() => {
                Configuration.createSchema({});
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
                Configuration.createSchema<{}>({ anyKey: [] });
            }, /Invalid schema structure/);
        });


        test(`${/*++N*/'006'/**/} from пустой — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>({
                    anyKey: { from: '', type: OptionType.String, spec: { fallback: '' } }
                });
            }, /path is empty/);
        });

        test(`${/*++N*/'007'/**/} поле spec отсутствует — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>({
                    anyKey: {
                        from: 'anyPath', type: OptionType.String
                    }
                });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'008'/**/} поле spec=null — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>({
                    anyKey: {
                        from: 'anyPath', type: OptionType.String,
                        spec: null
                    }
                });
            }, /Invalid schema structure at anyKey/);
        });

        test(`${/*++N*/'009'/**/} spec без fallback — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema<{}>({
                    anyKey: { from: 'anyPath', type: OptionType.String, spec: {} }
                });
            }, /Field spec is corrupted at anyKey/);
        });


        // Тест валидирует типы на этапе компиляции, рантайм не нужен → skip
        test.skip(`${/*++N*/'010'/**/} тест должен компилироваться (типизация корректна)`, function () {

            interface CnfI {
                anyKeyBool: boolean,
                anyKeyNumb: number,
                anyKeyStr: string,
                anyKeySet: Set<string>;
                d: {
                    e: {
                        e: {
                            p: string,
                        };
                    },
                    z: boolean,
                };
            }

            // интерфейс задан — ts помогает
            // ts видит неправильный тип спеки
            const schema = Configuration.createSchema<CnfI>({
                anyKeyBool: {
                    from: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: OptionType.StringSet,
                    spec: {
                        fallback: true
                    }
                },
                anyKeyNumb: {
                    from: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: OptionType.String,
                    spec: {
                        fallback: 42
                    }
                },
                anyKeyStr: {
                    from: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: OptionType.Number,
                    spec: {
                        fallback: '42'
                    }
                },
                anyKeySet: {
                    from: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: OptionType.Boolean,
                    spec: {
                        fallback: []
                    }
                }
            });

            // ts помогает
            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _anyKeyStr: StringOption = schema.anyKeyNumb;
            const _anyKeyStr_ok: Configuration.StringOption = schema.anyKeyStr;

            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _anyKeyNum: NumberOption = schema.anyKeyStr;
            const _anyKeyNum_ok: Configuration.NumberOption = schema.anyKeyNumb;

            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _p: BooleanOption = schema.d.e.e.p;
            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _z: StringOption = schema.d.z;

        });


        suite('String', function () {

            test(`${/*++N*/'011'/**/} фолбек не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: string; }>({
                        anyKey: { from: 'anyPath', type: OptionType.String, spec: { fallback: '127.0.0.0', pattern: /^\d+$/ } }
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'012'/**/} фолбек (пустая строка) не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: string; }>({
                        anyKey: { from: 'anyPath', type: OptionType.String, spec: { fallback: '', pattern: /^\d+$/ } }
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'013'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{ anyKeyStr: string; }>({
                        anyKeyStr: {
                            from: 'anyPath',
                            type: OptionType.String,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: 42
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'014'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {
                    Configuration.createSchema<{ anyKeyStr: string; }>({
                        anyKeyStr: { from: 'anyPath', type: OptionType.String, spec: { fallback: '42', pattern: /42/ } }
                    });

                });
            });

        });

        suite('Number', function () {

            test(`${/*++N*/'015'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{ anyKeyNumb: number; }>({
                        anyKeyNumb: {
                            from: 'anyPath',
                            type: OptionType.Number,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: '42'
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'016'/**/} fallback меньше min — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { min: 0, fallback: -1 } }
                    });
                }, /Fallback \(-?\d+\) is less than min/);
            });

            test(`${/*++N*/'017'/**/} fallback равно min — схема создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { min: 0, fallback: 0 } }
                    });
                });
            });

            test(`${/*++N*/'018'/**/} fallback больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { max: 0, fallback: 1 } }
                    });
                }, /Fallback \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'019'/**/} fallback равно max — схема создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { max: 1, fallback: 1 } }
                    });
                });
            });

            test(`${/*++N*/'020'/**/} min больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { min: 1, fallback: 0, max: -1 } }
                    });
                }, /Min \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'021'/**/} fallback равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.Number,
                            spec: { fallback: Infinity }
                        }
                    });
                }, /Invalid fallback value/);
            });


            test(`${/*++N*/'022'/**/} min равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.Number,
                            spec: { min: Infinity, fallback: 0 }
                        }
                    });
                }, /Min is not a finite number/);
            });


            test(`${/*++N*/'023'/**/} max равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.Number,
                            spec: { max: Infinity, fallback: 0 }
                        }
                    });
                }, /Max is not a finite number/);
            });


            test(`${/*++N*/'024'/**/} fallback равен NaN — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: number; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.Number,
                            spec: { fallback: NaN }
                        }
                    });
                }, /Invalid fallback/);
            });


            test(`${/*++N*/'025'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    Configuration.createSchema<{ anyKeyNum: number; }>({
                        anyKeyNum: { from: 'anyPath', type: OptionType.Number, spec: { min: 42, fallback: 42, max: 42 } }
                    });

                });
            });

        });

        suite('Boolean', function () {

            test(`${/*++N*/'026'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{ anyKeyBool: boolean; }>({
                        anyKeyBool: {
                            from: 'anyPath',
                            type: OptionType.Boolean,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: []
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'027'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    Configuration.createSchema<{ anyKeyBool: boolean; }>({
                        anyKeyBool: { from: 'anyPath', type: OptionType.Boolean, spec: { fallback: true } }
                    });

                });
            });

        });

        suite('StringSet', function () {

            test(`${/*++N*/'028'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{ anyKeySet: Set<string>; }>({
                        anyKeySet: {
                            from: 'anyPath',
                            type: OptionType.StringSet,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: true
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'029'/**/} fallback содержит не строки — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema<{ anyKeySet: Set<string>; }>({
                        anyKeySet: {
                            from: 'anyPath',
                            type: OptionType.StringSet,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: ['41', 42, '43']
                            }
                        }
                    });
                }, /Invalid fallback item/);

            });

            test(`${/*++N*/'030'/**/} fallback пустой массив — нормально создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{ anyKey: Set<string>; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.StringSet,
                            spec: { fallback: [] }
                        }
                    });
                });
            });

            test(`${/*++N*/'031'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    Configuration.createSchema<{ anyKeySet: Set<string>; }>({
                        anyKeySet: { from: 'anyPath', type: OptionType.StringSet, spec: { fallback: ['fallback'] } }
                    });

                });
            });

        });

        suite('StringLiteral', function () {

            test(`${/*++N*/'032'/**/} values не массив — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.StringLiteral,
                            spec: {
                                // @ts-expect-error
                                values: 'not-an-array',
                                fallback: 'a'
                            }
                        }
                    });
                }, /Invalid values/);
            });

            test(`${/*++N*/'033'/**/} values содержит пустую строку — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.StringLiteral,
                            spec: {
                                // @ts-expect-error
                                values: ['a', ''],
                                fallback: 'a'
                            }
                        }
                    });
                }, /Invalid literal value/);
            });

            test(`${/*++N*/'034'/**/} values содержит не-строку — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.StringLiteral,
                            spec: {
                                // @ts-expect-error
                                values: ['a', 42],
                                fallback: 'a'
                            }
                        }
                    });
                }, /Invalid literal value/);
            });

            test(`${/*++N*/'035'/**/} fallback не строка — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.StringLiteral,
                            spec: {
                                values: ['a', 'b'],
                                // @ts-expect-error
                                fallback: 42
                            }
                        }
                    });
                }, /Invalid fallback type/);
            });

            test(`${/*++N*/'036'/**/} fallback не входит в values — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.StringLiteral,
                            spec: {
                                values: ['a', 'b'],
                                // @ts-expect-error
                                fallback: 'c'
                            }
                        }
                    });
                }, /is not included in values/);
            });

            test(`${/*++N*/'037'/**/} валидная схема — нормально создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            from: 'anyPath',
                            type: OptionType.StringLiteral,
                            spec: { values: ['a', 'b'], fallback: 'a' }
                        }
                    });
                });
            });

        });

    });

});
