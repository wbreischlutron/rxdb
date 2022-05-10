import assert from 'assert';
import {
    clone
} from 'async-test-util';

import config from './config';
import * as schemas from '../helper/schemas';

import {
    fillWithDefaultSettings,
    RxJsonSchema,
    getQueryPlan,
    normalizeMangoQuery,
    MAX_CHAR
} from '../../';


import type {
    RxDocumentData
} from '../../src/types';
import { HumanDocumentType } from '../helper/schemas';


config.parallel('query-planner.test.js', () => {
    function getHumanSchemaWithIndexes(
        indexes: string[][]
    ): RxJsonSchema<RxDocumentData<HumanDocumentType>> {
        const schema = clone(schemas.human);
        schema.indexes = indexes;
        return fillWithDefaultSettings(schema);
    }

    describe('.getQueryPlan()', () => {
        it('should pick the default index when no indexes specified in the schema', () => {
            const schema = getHumanSchemaWithIndexes([]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {}
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['passportId']);
        });
        it('should respect the given index', () => {
            const customSetIndex = ['firstName'];
            const schema = getHumanSchemaWithIndexes([customSetIndex]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {
                    index: customSetIndex
                }
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['firstName', 'passportId']);
        });
        it('should have the correct start- and end keys', () => {
            const schema = getHumanSchemaWithIndexes([['age']]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {
                    selector: {
                        age: {
                            $gte: 20
                        }
                    }
                }
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['age', 'passportId']);
            assert.strictEqual(queryPlan.startKeys[0], 20);
            assert.strictEqual(queryPlan.endKeys[0], MAX_CHAR);
            assert.ok(queryPlan.inclusiveStart);
        });
    });

    describe('always prefer the better index', () => {
        it('should prefer the default index over one that has no fields of the query', () => {
            const schema = getHumanSchemaWithIndexes([['firstName']]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {
                    selector: {
                        age: {
                            $eq: 10
                        }
                    }
                }
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['passportId']);
        });
        it('should prefer the index that reduces the read-count by having a non-minimal startKey', () => {
            const schema = getHumanSchemaWithIndexes([
                ['firstName', 'age'],
                ['age', 'firstName']
            ]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {
                    selector: {
                        age: {
                            $eq: 10
                        }
                    }
                }
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['age', 'firstName', 'passportId']);
        });
        it('should prefer the index that matches the sort order, if no selector given', () => {
            const schema = getHumanSchemaWithIndexes([
                ['firstName', 'age'],
                ['age', 'firstName']
            ]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {
                    sort: [
                        { age: 'asc' },
                        { firstName: 'asc' }
                    ]
                }
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['age', 'firstName', 'passportId']);
        });
        it('should prefer the index that matches the sort order, if selector for both fiels is used', () => {
            const schema = getHumanSchemaWithIndexes([
                ['firstName', 'age'],
                ['age', 'firstName']
            ]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {
                    selector: {
                        age: {
                            $gt: 20
                        },
                        firstName: {
                            $gt: 'aaa'
                        }
                    },
                    sort: [
                        { age: 'asc' },
                        { firstName: 'asc' }
                    ]
                }
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['age', 'firstName', 'passportId']);
        });
        it('should prefer indexing over the $eq operator over the $gt operator', () => {
            const schema = getHumanSchemaWithIndexes([
                ['firstName', 'age'],
                ['age', 'firstName']
            ]);
            const query = normalizeMangoQuery<HumanDocumentType>(
                schema,
                {
                    selector: {
                        age: {
                            $gt: 20
                        },
                        firstName: {
                            $eq: 'aaa'
                        }
                    },
                    sort: [
                        { age: 'asc' },
                        { firstName: 'asc' }
                    ]
                }
            );
            const queryPlan = getQueryPlan(
                schema,
                query
            );
            assert.deepStrictEqual(queryPlan.index, ['firstName', 'age', 'passportId']);
        });
    });


    // TODO
    describe('TODO', () => {
        it('TODO', () => {
            process.exit();
        });
    });
});
