import * as assert from 'assert/strict';
import * as vscode from 'vscode';
import {
    createSchema,
    SpecType,
    NumberOption,
    StringOption
} from 'src/StateCoordinator/ConfigSchema/ConfigSchema';



// `${/*N=0*/'000'/**/}`

suite('ConfigSchema', function () {

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.task-cockpit');
        assert.ok(ext);
        await ext.activate();
    });

    suite('createSchema', function () {

        test(`${/*++N*/'001'/**/} пустая схема — нормально создание схемы`, function () {
            assert.doesNotThrow(() => {
                createSchema({});
            });
        });

        test(`${/*++N*/'002'/**/} значение true (не объект) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>(
                    { anyKey: true }
                );
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'003'/**/} значение false (не объект) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>(
                    { anyKey: false }
                );
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'004'/**/} значение undefined — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>(
                    { anyKey: undefined }
                );
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'005'/**/} значение [] (массив) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>({ anyKey: [] });
            }, /Invalid schema structure/);
        });


        test(`${/*++N*/'006'/**/} section не строка — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>({
                    anyKey: { section: [''], type: SpecType.String, spec: { fallback: '' } }
                });
            }, /Invalid schema structure/);
        });


        test(`${/*++N*/'008'/**/} поле spec отсутствует — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>({
                    anyKey: {
                        section: 'anyPath', type: SpecType.String
                    }
                });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'009'/**/} поле spec=null — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>({
                    anyKey: {
                        section: 'anyPath', type: SpecType.String,
                        spec: null
                    }
                });
            }, /Invalid schema structure at anyKey/);
        });

        test(`${/*++N*/'010'/**/} spec без fallback — ошибка при создании схемы`, function () {
            assert.throws(() => {
                createSchema<{}>({
                    anyKey: { section: 'anyPath', type: SpecType.String, spec: {} }
                });
            }, /Field spec is corrupted at anyKey/);
        });


        // Тест валидирует типы на этапе компиляции, рантайм не нужен → skip
        test.skip(`${/*++N*/'011'/**/} тест должен компилироваться (типизация корректна)`, function () {

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
            const schema = createSchema<CnfI>({
                anyKeyBool: {
                    section: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: SpecType.StringSet,
                    spec: {
                        fallback: true
                    }
                },
                anyKeyNumb: {
                    section: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: SpecType.String,
                    spec: {
                        fallback: 42
                    }
                },
                anyKeyStr: {
                    section: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: SpecType.Number,
                    spec: {
                        fallback: '42'
                    }
                },
                anyKeySet: {
                    section: 'anyPath',
                    // @ts-expect-error /* проверка что ts видит здесь ошибку */
                    type: SpecType.Boolean,
                    spec: {
                        fallback: []
                    }
                }
            });

            // ts помогает
            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _anyKeyStr: StringOption = schema.anyKeyNumb;
            const _anyKeyStr_ok: StringOption = schema.anyKeyStr;

            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _anyKeyNum: NumberOption = schema.anyKeyStr;
            const _anyKeyNum_ok: NumberOption = schema.anyKeyNumb;

            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _p: BooleanOption = schema.d.e.e.p;
            // @ts-expect-error /* проверка что ts видит здесь ошибку */
            const _z: StringOption = schema.d.z;

        });


        suite('String', function () {

            test(`${/*++N*/'012'/**/} фолбек не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: string; }>({
                        anyKey: { section: 'anyPath', type: SpecType.String, spec: { fallback: '127.0.0.0', pattern: /^\d+$/ } }
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'013'/**/} фолбек (пустая строка) не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: string; }>({
                        anyKey: { section: 'anyPath', type: SpecType.String, spec: { fallback: '', pattern: /^\d+$/ } }
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'014'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    createSchema<{ anyKeyStr: string; }>({
                        anyKeyStr: {
                            section: 'anyPath',
                            type: SpecType.String,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: 42
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'015'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {
                    createSchema<{ anyKeyStr: string; }>({
                        anyKeyStr: { section: 'anyPath', type: SpecType.String, spec: { fallback: '42', pattern: /42/ } }
                    });

                });
            });

        });

        suite('Number', function () {

            test(`${/*++N*/'016'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    createSchema<{ anyKeyNumb: number; }>({
                        anyKeyNumb: {
                            section: 'anyPath',
                            type: SpecType.Number,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: '42'
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'017'/**/} fallback меньше min — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: { section: 'anyPath', type: SpecType.Number, spec: { min: 0, fallback: -1 } }
                    });
                }, /Fallback \(-?\d+\) is less than min/);
            });

            test(`${/*++N*/'018'/**/} fallback равно min — схема создается`, function () {
                assert.doesNotThrow(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: { section: 'anyPath', type: SpecType.Number, spec: { min: 0, fallback: 0 } }
                    });
                });
            });

            test(`${/*++N*/'019'/**/} fallback больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: { section: 'anyPath', type: SpecType.Number, spec: { max: 0, fallback: 1 } }
                    });
                }, /Fallback \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'020'/**/} fallback равно max — схема создается`, function () {
                assert.doesNotThrow(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: { section: 'anyPath', type: SpecType.Number, spec: { max: 1, fallback: 1 } }
                    });
                });
            });

            test(`${/*++N*/'021'/**/} min больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: { section: 'anyPath', type: SpecType.Number, spec: { min: 1, fallback: 0, max: -1 } }
                    });
                }, /Min \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'022'/**/} fallback равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.Number,
                            spec: { fallback: Infinity }
                        }
                    });
                }, /Invalid fallback value/);
            });


            test(`${/*++N*/'023'/**/} min равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.Number,
                            spec: { min: Infinity, fallback: 0 }
                        }
                    });
                }, /Min is not a finite number/);
            });


            test(`${/*++N*/'024'/**/} max равен Infinity — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.Number,
                            spec: { max: Infinity, fallback: 0 }
                        }
                    });
                }, /Max is not a finite number/);
            });


            test(`${/*++N*/'025'/**/} fallback равен NaN — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: number; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.Number,
                            spec: { fallback: NaN }
                        }
                    });
                }, /Invalid fallback/);
            });


            test(`${/*++N*/'026'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    createSchema<{ anyKeyNum: number; }>({
                        anyKeyNum: { section: 'anyPath', type: SpecType.Number, spec: { min: 42, fallback: 42, max: 42 } }
                    });

                });
            });

        });

        suite('Boolean', function () {

            test(`${/*++N*/'027'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    createSchema<{ anyKeyBool: boolean; }>({
                        anyKeyBool: {
                            section: 'anyPath',
                            type: SpecType.Boolean,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: []
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'028'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    createSchema<{ anyKeyBool: boolean; }>({
                        anyKeyBool: { section: 'anyPath', type: SpecType.Boolean, spec: { fallback: true } }
                    });

                });
            });

        });

        suite('StringSet', function () {

            test(`${/*++N*/'029'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    createSchema<{ anyKeySet: Set<string>; }>({
                        anyKeySet: {
                            section: 'anyPath',
                            type: SpecType.StringSet,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: true
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'030'/**/} fallback содержит не строки — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    createSchema<{ anyKeySet: Set<string>; }>({
                        anyKeySet: {
                            section: 'anyPath',
                            type: SpecType.StringSet,
                            spec: {
                                // @ts-expect-error /* ts видит здесь ошибку */
                                fallback: ['41', 42, '43']
                            }
                        }
                    });
                }, /Invalid fallback item/);

            });

            test(`${/*++N*/'031'/**/} fallback пустой массив — нормально создается`, function () {
                assert.doesNotThrow(() => {
                    createSchema<{ anyKey: Set<string>; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.StringSet,
                            spec: { fallback: [] }
                        }
                    });
                });
            });

            test(`${/*++N*/'032'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    createSchema<{ anyKeySet: Set<string>; }>({
                        anyKeySet: { section: 'anyPath', type: SpecType.StringSet, spec: { fallback: ['fallback'] } }
                    });

                });
            });

        });

        suite('StringLiteral', function () {

            test(`${/*++N*/'033'/**/} values не массив — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.StringLiteral,
                            spec: {
                                // @ts-expect-error
                                values: 'not-an-array',
                                fallback: 'a'
                            }
                        }
                    });
                }, /Invalid values/);
            });

            test(`${/*++N*/'034'/**/} values содержит пустую строку — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.StringLiteral,
                            spec: {
                                // @ts-expect-error
                                values: ['a', ''],
                                fallback: 'a'
                            }
                        }
                    });
                }, /Invalid literal value/);
            });

            test(`${/*++N*/'035'/**/} values содержит не-строку — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.StringLiteral,
                            spec: {
                                // @ts-expect-error
                                values: ['a', 42],
                                fallback: 'a'
                            }
                        }
                    });
                }, /Invalid literal value/);
            });

            test(`${/*++N*/'036'/**/} fallback не строка — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.StringLiteral,
                            spec: {
                                values: ['a', 'b'],
                                // @ts-expect-error
                                fallback: 42
                            }
                        }
                    });
                }, /Invalid fallback type/);
            });

            test(`${/*++N*/'037'/**/} fallback не входит в values — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.StringLiteral,
                            spec: {
                                values: ['a', 'b'],
                                // @ts-expect-error
                                fallback: 'c'
                            }
                        }
                    });
                }, /is not included in values/);
            });

            test(`${/*++N*/'038'/**/} валидная схема — нормально создается`, function () {
                assert.doesNotThrow(() => {
                    createSchema<{ anyKey: 'a' | 'b'; }>({
                        anyKey: {
                            section: 'anyPath',
                            type: SpecType.StringLiteral,
                            spec: { values: ['a', 'b'], fallback: 'a' }
                        }
                    });
                });
            });

        });
    });
});
