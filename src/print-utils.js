function roundFloat(duration = 0) {
    return duration.toFixed(2);
}

function getExclusive(lastMeasurement) {
    var aggregatedStats = {};
    var affectedIDs = {};

    function updateAggregatedStats(treeSnapshot, instanceID, timerType, applyUpdate) {
        var displayName = treeSnapshot[instanceID].displayName;

        var key = displayName;
        var stats = aggregatedStats[key];
        if (!stats) {
            affectedIDs[key] = {};
            stats = aggregatedStats[key] = {
                key: key,
                instanceCount: 0,
                counts: {},
                durations: {},
                totalDuration: 0
            };
        }
        if (!stats.durations[timerType]) {
            stats.durations[timerType] = 0;
        }
        if (!stats.counts[timerType]) {
            stats.counts[timerType] = 0;
        }
        affectedIDs[key][instanceID] = true;
        applyUpdate(stats);
    }

    lastMeasurement.forEach(function (flush) {
        var measurements = flush.measurements;
        var treeSnapshot = flush.treeSnapshot;

        measurements.forEach(function (measurement) {
            var duration = measurement.duration;
            var instanceID = measurement.instanceID;
            var timerType = measurement.timerType;

            updateAggregatedStats(treeSnapshot, instanceID, timerType, function (stats) {
                stats.totalDuration += duration;
                stats.durations[timerType] += duration;
                stats.counts[timerType]++;
            });
        });
    });

    return Object.keys(aggregatedStats).map(function (key) {
        return Object.assign({}, aggregatedStats[key], {
            instanceCount: Object.keys(affectedIDs[key]).length
        });
    }).sort(function (a, b) {
        return b.totalDuration - a.totalDuration;
    });
}

function getInclusive(lastMeasurement) {
    var aggregatedStats = {};
    var affectedIDs = {};

    function updateAggregatedStats(treeSnapshot, instanceID, applyUpdate) {
        var _treeSnapshot$instanc = treeSnapshot[instanceID];
        var displayName = _treeSnapshot$instanc.displayName;
        var ownerID = _treeSnapshot$instanc.ownerID;

        var owner = treeSnapshot[ownerID];
        var key = (owner ? owner.displayName + ' > ' : '') + displayName;
        var stats = aggregatedStats[key];
        if (!stats) {
            affectedIDs[key] = {};
            stats = aggregatedStats[key] = {
                key: key,
                instanceCount: 0,
                inclusiveRenderDuration: 0,
                renderCount: 0
            };
        }
        affectedIDs[key][instanceID] = true;
        applyUpdate(stats);
    }

    var isCompositeByID = {};
    lastMeasurement.forEach(function (flush) {
        var measurements = flush.measurements;

        measurements.forEach(function (measurement) {
            var instanceID = measurement.instanceID;
            var timerType = measurement.timerType;

            if (timerType !== 'render') {
                return;
            }
            isCompositeByID[instanceID] = true;
        });
    });

    lastMeasurement.forEach(function (flush) {
        var measurements = flush.measurements;
        var treeSnapshot = flush.treeSnapshot;

        measurements.forEach(function (measurement) {
            var duration = measurement.duration;
            var instanceID = measurement.instanceID;
            var timerType = measurement.timerType;

            if (timerType !== 'render') {
                return;
            }
            updateAggregatedStats(treeSnapshot, instanceID, function (stats) {
                stats.renderCount++;
            });
            var nextParentID = instanceID;
            while (nextParentID) {
                // As we traverse parents, only count inclusive time towards composites.
                // We know something is a composite if its render() was called.
                if (isCompositeByID[nextParentID]) {
                    updateAggregatedStats(treeSnapshot, nextParentID, function (stats) {
                        stats.inclusiveRenderDuration += duration;
                    });
                }
                nextParentID = treeSnapshot[nextParentID].parentID;
            }
        });
    });

    return Object.keys(aggregatedStats).map(function (key) {
        return Object.assign({}, aggregatedStats[key], {
            instanceCount: Object.keys(affectedIDs[key]).length
        });
    }).sort(function (a, b) {
        return b.inclusiveRenderDuration - a.inclusiveRenderDuration;
    });
}

function getWasted(lastMeasurement) {
    var aggregatedStats = {};
    var affectedIDs = {};

    function updateAggregatedStats(treeSnapshot, instanceID, applyUpdate) {
        var _treeSnapshot$instanc2 = treeSnapshot[instanceID];
        var displayName = _treeSnapshot$instanc2.displayName;
        var ownerID = _treeSnapshot$instanc2.ownerID;

        var owner = treeSnapshot[ownerID];
        var key = (owner ? owner.displayName + ' > ' : '') + displayName;
        var stats = aggregatedStats[key];
        if (!stats) {
            affectedIDs[key] = {};
            stats = aggregatedStats[key] = {
                key: key,
                instanceCount: 0,
                inclusiveRenderDuration: 0,
                renderCount: 0
            };
        }
        affectedIDs[key][instanceID] = true;
        applyUpdate(stats);
    }

    lastMeasurement.forEach(function (flush) {
        var measurements = flush.measurements;
        var treeSnapshot = flush.treeSnapshot;
        var operations = flush.operations;

        var isDefinitelyNotWastedByID = {};

        // Find host components associated with an operation in this batch.
        // Mark all components in their parent tree as definitely not wasted.
        operations.forEach(function (operation) {
            var instanceID = operation.instanceID;

            var nextParentID = instanceID;
            while (nextParentID) {
                isDefinitelyNotWastedByID[nextParentID] = true;
                nextParentID = treeSnapshot[nextParentID].parentID;
            }
        });

        // Find composite components that rendered in this batch.
        // These are potential candidates for being wasted renders.
        var renderedCompositeIDs = {};
        measurements.forEach(function (measurement) {
            var instanceID = measurement.instanceID;
            var timerType = measurement.timerType;

            if (timerType !== 'render') {
                return;
            }
            renderedCompositeIDs[instanceID] = true;
        });

        measurements.forEach(function (measurement) {
            var duration = measurement.duration;
            var instanceID = measurement.instanceID;
            var timerType = measurement.timerType;

            if (timerType !== 'render') {
                return;
            }

            // If there was a DOM update below this component, or it has just been
            // mounted, its render() is not considered wasted.
            var updateCount = treeSnapshot[instanceID].updateCount;

            if (isDefinitelyNotWastedByID[instanceID] || updateCount === 0) {
                return;
            }

            // We consider this render() wasted.
            updateAggregatedStats(treeSnapshot, instanceID, function (stats) {
                stats.renderCount++;
            });

            var nextParentID = instanceID;
            while (nextParentID) {
                // Any parents rendered during this batch are considered wasted
                // unless we previously marked them as dirty.
                var isWasted = renderedCompositeIDs[nextParentID] && !isDefinitelyNotWastedByID[nextParentID];
                if (isWasted) {
                    updateAggregatedStats(treeSnapshot, nextParentID, function (stats) {
                        stats.inclusiveRenderDuration += duration;
                    });
                }
                nextParentID = treeSnapshot[nextParentID].parentID;
            }
        });
    });

    return Object.keys(aggregatedStats).map(function (key) {
        return Object.assign({}, aggregatedStats[key], {
            instanceCount: Object.keys(affectedIDs[key]).length
        });
    }).sort(function (a, b) {
        return b.inclusiveRenderDuration - a.inclusiveRenderDuration;
    });
}

function getOperations(lastMeasurement) {
    var stats = [];
    lastMeasurement.forEach(function (flush, flushIndex) {
        var operations = flush.operations;
        var treeSnapshot = flush.treeSnapshot;

        operations.forEach(function (operation) {
            var instanceID = operation.instanceID;
            var type = operation.type;
            var payload = operation.payload;
            var _treeSnapshot$instanc3 = treeSnapshot[instanceID];
            var displayName = _treeSnapshot$instanc3.displayName;
            var ownerID = _treeSnapshot$instanc3.ownerID;

            var owner = treeSnapshot[ownerID];
            var key = (owner ? owner.displayName + ' > ' : '') + displayName;

            stats.push({
                flushIndex: flushIndex,
                instanceID: instanceID,
                key: key,
                type: type,
                ownerID: ownerID,
                payload: payload
            });
        });
    });

    return stats;
}

export function printExclusive(lastMeasurement) {
    var stats = getExclusive(lastMeasurement);
    var table = stats.map(function (item) {
        var key = item.key;
        var instanceCount = item.instanceCount;
        var totalDuration = item.totalDuration;

        var renderCount = item.counts.render || 0;
        var renderDuration = item.durations.render || 0;
        return {
            'Component': key,
            'Total time (ms)': roundFloat(totalDuration),
            'Instance count': instanceCount,
            'Total render time (ms)': roundFloat(renderDuration),
            'Average render time (ms)': renderCount ? roundFloat(renderDuration / renderCount) : undefined,
            'Render count': renderCount,
            'Total lifecycle time (ms)': roundFloat(totalDuration - renderDuration)
        };
    });
    return table;
}

export function printInclusive(lastMeasurement) {
    var stats = getInclusive(lastMeasurement);
    var table = stats.map(function (item) {
        var key = item.key;
        var instanceCount = item.instanceCount;
        var inclusiveRenderDuration = item.inclusiveRenderDuration;
        var renderCount = item.renderCount;

        return {
            'Owner > Component': key,
            'Inclusive render time (ms)': roundFloat(inclusiveRenderDuration),
            'Instance count': instanceCount,
            'Render count': renderCount
        };
    });

    return table;
}

export function printWasted(lastMeasurement) {
    var stats = getWasted(lastMeasurement);
    var table = stats.map(function (item) {
        var key = item.key;
        var instanceCount = item.instanceCount;
        var inclusiveRenderDuration = item.inclusiveRenderDuration;
        var renderCount = item.renderCount;

        return {
            'Owner > Component': key,
            'Inclusive wasted time (ms)': roundFloat(inclusiveRenderDuration),
            'Instance count': instanceCount,
            'Render count': renderCount
        };
    });

    return table;
}

export function printOperations(lastMeasurement) {
    var stats = getOperations(lastMeasurement);
    var table = stats.map(function (stat) {
        return {
            'Owner > Node': stat.key,
            'Operation': stat.type,
            'Payload': typeof stat.payload === 'object' ? JSON.stringify(stat.payload) : stat.payload,
            'Flush index': stat.flushIndex,
            'Owner Component ID': stat.ownerID,
            'DOM Component ID': stat.instanceID
        };
    });

    return table;
}
