import * as assert from 'assert/strict';

import Configuration from '../../../src/Workspace/Settings/Configuration';
import {
    BooleanOption,
    OptionType,
    NumberOption,
    StringOption
} from '../../../src/Workspace/Settings/Configuration';

// `${/*N=0*/'000'/**/}` 

suite('Configuration', function () {

    suite('createSchema', function () {

        test(`${/*++N*/'001'/**/} значение true (не объект) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({ anyKey: true });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'002'/**/} значение false (не объект) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({ anyKey: false });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'003'/**/} значение undefined — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({
                    // @ts-expect-error /* специально так сделано */
                    anyKey: undefined
                });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'004'/**/} значение [] (массив) — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({ anyKey: [] });
            }, /Invalid schema structure/);
        });


        test(`${/*++N*/'005'/**/} from пустой — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({
                    anyKey: { from: '', type: OptionType.String, spec: { fallback: '' } }
                });
            }, /path is empty/);
        });

        test(`${/*++N*/'006'/**/} поле spec отсутствует — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({
                    anyKey: {
                        from: 'anyPath', type: OptionType.String
                    }
                });
            }, /Invalid schema structure/);
        });

        test(`${/*++N*/'007'/**/} поле spec=null — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({
                    anyKey: {
                        from: 'anyPath', type: OptionType.String,
                        // @ts-expect-error /* специально подавляет ошибку */
                        spec: null
                    }
                });
            }, /Invalid schema structure at anyKey/);
        });

        test(`${/*++N*/'008'/**/} spec без fallback — ошибка при создании схемы`, function () {
            assert.throws(() => {
                Configuration.createSchema({
                    anyKey: { from: 'anyPath', type: OptionType.String, spec: {} }
                });
            }, /Field spec is corrupted at anyKey/);
        });


        // Тест валидирует типы на этапе компиляции, рантайм не нужен → skip
        test.skip(`${/*++N*/'009'/**/} тест должен компилироваться (типизация корректна)`, function () {

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

            test(`${/*++N*/'010'/**/} фолбек не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema({
                        anyKey: { from: 'anyPath', type: OptionType.String, spec: { fallback: '127.0.0.0', pattern: /^\d+$/ } }
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'011'/**/} фолбек (пустая строка) не проходит pattern — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema({
                        anyKey: { from: 'anyPath', type: OptionType.String, spec: { fallback: '', pattern: /^\d+$/ } }
                    });
                }, /does not match pattern/);
            });

            test(`${/*++N*/'012'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema({
                        anyKeyStr: {
                            from: 'anyPath',
                            type: OptionType.String,
                            spec: {
                                fallback: 42
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'013'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    interface SchemaI {
                        anyKeyStr: string;
                    }

                    Configuration.createSchema<SchemaI>({
                        anyKeyStr: { from: 'anyPath', type: OptionType.String, spec: { fallback: '42', pattern: /42/ } }
                    });

                });
            });

        });

        suite('Number', function () {

            test(`${/*++N*/'014'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema({
                        anyKeyNumb: {
                            from: 'anyPath',
                            type: OptionType.Number,
                            spec: {
                                fallback: '42'
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'015'/**/} fallback меньше min — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { min: 0, fallback: -1 } }
                    });
                }, /Fallback \(-?\d+\) is less than min/);
            });

            test(`${/*++N*/'016'/**/} fallback равно min — схема создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { min: 0, fallback: 0 } }
                    });
                });
            });

            test(`${/*++N*/'017'/**/} fallback больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { max: 0, fallback: 1 } }
                    });
                }, /Fallback \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'018'/**/} fallback равно max — схема создается`, function () {
                assert.doesNotThrow(() => {
                    Configuration.createSchema({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { max: 1, fallback: 1 } }
                    });
                });
            });

            test(`${/*++N*/'019'/**/} min больше max — ошибка при создании схемы`, function () {
                assert.throws(() => {
                    Configuration.createSchema({
                        anyKey: { from: 'anyPath', type: OptionType.Number, spec: { min: 1, fallback: 0, max: -1 } }
                    });
                }, /Min \(\d+\) is greater than max/);
            });

            test(`${/*++N*/'020'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    interface SchemaI {
                        anyKeyNum: number;
                    }

                    Configuration.createSchema<SchemaI>({
                        anyKeyNum: { from: 'anyPath', type: OptionType.Number, spec: { min: 42, fallback: 42, max: 42 } }
                    });

                });
            });

        });

        suite('Boolean', function () {

            test(`${/*++N*/'021'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema({
                        anyKeyBool: {
                            from: 'anyPath',
                            type: OptionType.Boolean,
                            spec: {
                                fallback: []
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'022'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    interface SchemaI {
                        anyKeyBool: boolean;
                    }

                    Configuration.createSchema<SchemaI>({
                        anyKeyBool: { from: 'anyPath', type: OptionType.Boolean, spec: { fallback: true } }
                    });

                });
            });

        });

        suite('StringSet', function () {

            test(`${/*++N*/'023'/**/} fallback неправильного типа — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema({
                        anyKeySet: {
                            from: 'anyPath',
                            type: OptionType.StringSet,
                            spec: {
                                fallback: true
                            }
                        }
                    });
                }, /Invalid fallback type/);

            });

            test(`${/*++N*/'024'/**/} fallback содержит не строки — ошибка при создании схемы`, function () {

                assert.throws(() => {
                    Configuration.createSchema({
                        anyKeySet: {
                            from: 'anyPath',
                            type: OptionType.StringSet,
                            spec: {
                                fallback: ['41', 42, '43']
                            }
                        }
                    });
                }, /Invalid fallback item/);

            });

            test(`${/*++N*/'025'/**/} валидная схема — нормально создается`, function () {

                assert.doesNotThrow(() => {

                    interface SchemaI {
                        anyKeySet: Set<string>;
                    }

                    Configuration.createSchema<SchemaI>({
                        anyKeySet: { from: 'anyPath', type: OptionType.StringSet, spec: { fallback: ['fallback'] } }
                    });

                });
            });

        });

    });

});
