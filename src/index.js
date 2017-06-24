import React from 'react';
import PropTypes from 'prop-types';
import addons from '@storybook/addons';
import Perf from 'react-addons-perf';

export class WithPerf extends React.Component {
    componentWillMount() {
        Perf.start();
    }

    componentDidMount() {
        Perf.stop();
    }

    render() {
        const measurements = Perf.getLastMeasurements();
        const { children } = this.props;
        const channel = addons.getChannel();

        // send the measurements to the channel.
        channel.emit('storybook/perf/record_perf', measurements);

        // return children elements.
        return children;
    }
}

WithPerf.propTypes = {
    children: PropTypes.node,
};
WithPerf.defaultProps = {
    children: null,
};
