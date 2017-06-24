/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions, react/display-name */

import React from 'react';
import PropTypes from 'prop-types';
import addons from '@storybook/addons';
import { printExclusive, printInclusive, printWasted, printOperations } from './print-utils';

const styles = {
    perfPanel: {
        margin: 10,
        fontFamily: 'Arial',
        fontSize: 14,
        color: '#444',
        width: '100%',
        overflow: 'auto',
    },
    innerPanel: {
        padding: 10,
    },
    tableRoot: {
        borderCollapse: 'collapse',
    },
    tableEntry: {
        border: '1px solid #dddddd',
        textAlign: 'left',
        padding: '8px',
    },
};

export class Perf extends React.Component {
    constructor(...args) {
        super(...args);
        this.state = { measurements: {} };
        this.onGetMeasurements = this.onGetMeasurements.bind(this);
        this.renderTable = this.renderTable.bind(this);
        this.getKeys = this.getKeys.bind(this);
    }

    componentDidMount() {
        const { channel, api } = this.props;
        channel.on('storybook/perf/record_perf', this.onGetMeasurements);

        // Clear the current notes on every story change.
        this.stopListeningOnStory = api.onStory(() => {
            this.onGetMeasurements('');
        });
    }

    // This is some cleanup tasks when the Notes panel is unmounting.
    componentWillUnmount() {
        if (this.stopListeningOnStory) {
            this.stopListeningOnStory();
        }

        this.unmounted = true;
        const { channel } = this.props;
        channel.removeListener('storybook/perf/record_perf', this.onGetMeasurements);
    }

    onGetMeasurements(measurements) {
        this.setState({ measurements });
    }

    getKeys(obj) {
        const keys = [];
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys;
    }

    renderTable(entries) {
        const headers = this.getKeys(entries[0]);
        return (
            <table style={styles.tableRoot}>
                <thead>
                <tr>
                    {headers.map((header, i) => {
                        return (
                            <th key={`entry-td-${i}`} style={styles.tableEntry}>{header}</th>
                        );
                    })}
                </tr>
                </thead>
                <tbody>
                {entries.map((entry, j) => {
                    return (
                        <tr key={`entry-tr-${j}`}>
                            {Object.keys(entry).map((entryKey, k) => {
                                return (
                                    <td key={`entry-td-${k}`} style={styles.tableEntry}>{entry[entryKey]}</td>
                                )
                            })}
                        </tr>
                    );
                })}
                </tbody>
            </table>
        )
    }

    render() {
        const { measurements } = this.state;

        if (!Array.isArray(measurements)) return null;

        const lastMeasurement = measurements[0];
        if (!lastMeasurement) {
            return (
                <div style={styles.notesPanel}>
                    <div>No measurements</div>
                </div>
            );
        }

        const inclusiveEntries = printInclusive(measurements);
        const wastedEntries = printWasted(measurements);
        const exclusiveEntries = printExclusive(measurements);
        const operationsEntries = printOperations(measurements);
        return (
            <div style={styles.notesPanel}>
                <div style={styles.innerPanel}>
                    <h3>Print Inclusive</h3>
                    {this.renderTable(inclusiveEntries)}

                    <h3>Print Wasted</h3>
                    {this.renderTable(wastedEntries)}

                    <h3>Print Exclusive</h3>
                    {this.renderTable(exclusiveEntries)}

                    <h3>Print Operations</h3>
                    {this.renderTable(operationsEntries)}
                </div>
            </div>
        );
    }
}

Perf.propTypes = {
    channel: PropTypes.object, // eslint-disable-line react/forbid-prop-types
    api: PropTypes.object, // eslint-disable-line react/forbid-prop-types
};
Perf.defaultProps = {
    channel: {},
    api: {},
};

// Register the addon with a unique name.
addons.register('storybook/perf', api => {
    // Also need to set a unique name to the panel.
    addons.addPanel('storybook/perf/panel', {
        title: 'Perf',
        render: () => <Perf channel={addons.getChannel()} api={api} />,
    });
});
