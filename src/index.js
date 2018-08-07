import { autorun, action } from 'mobx'
import { vizabi } from './vizabi'
import { config } from './config'
import appState from './appState'

var ddfcsv = new DDFCsvReader.getDDFCsvReaderObject();
var waffle = new WsReader.WsReader.getReader();
vizabi.stores.dataSource.createAndAddType('ddfcsv', ddfcsv);
vizabi.stores.dataSource.createAndAddType('waffle', waffle);
window.viz = vizabi(config);
window.vizabi = vizabi;
window.autorun = autorun;

/*spy((event) => {
    console.log(`${event.name}`, event)
})*/

//autorun(chart);
chart();

function chart() {

    const config = appState;
    const marker = viz.stores.marker.get("bubble");

    var margin = config.margin;

    var xAxis = d3.axisBottom();
    var yAxis = d3.axisLeft();

    var chart = d3.select("#chart"); //.html("");
    var svg = chart.append("g");
    var xAxisSVG = svg.append("g")
        .attr("class", "x axis");
    var xAxisSVGtext = xAxisSVG
        .append("text")
        .attr("class", "label")
        .attr("y", -6)
        .style("text-anchor", "end");
    var yAxisSVG = svg.append("g")
        .attr("class", "y axis");
    var yAxisSVGtext = yAxisSVG.append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end");


    let playtoggle, timeslider, speedslider;

    function setupTimecontrol() {

        const frameCfg = marker.encoding.get("frame");

        const timecontrol = d3.select("#timecontrol");
        playtoggle = timecontrol.select("#toggle")
            .on('click', function() { frameCfg.togglePlaying() })
        timeslider = timecontrol.select("#timeslider")
            .on('input', function() { frameCfg.setValueAndStop(this.value) });
        speedslider = timecontrol.select("#speedslider")
            .attr('min', 1)
            .attr('max', 1000)
            .style('direction', 'rtl')
            .on('input', function() { frameCfg.setSpeed(this.value) });
    }

    const updateSize = action("wrapper size", function(e) {
        var wrap = document.getElementById("wrapper");
        appState.wrapper.height = wrap.clientHeight;
        appState.wrapper.width = wrap.clientWidth;
    });
    window.addEventListener("resize", updateSize);
    updateSize();

    autorun(setupTimecontrol);
    autorun(drawBubbles);
    autorun(drawChart);
    autorun(drawLegend);
    autorun(drawTimecontrol);
    //drawBubbles();
    //drawChart();
    //drawLegend();

    function drawTimecontrol() {
        const frameCfg = marker.encoding.get("frame");
        const [min, max] = frameCfg.scale.domain || [0, 1];
        timeslider.attr('min', min)
            .attr('max', max)
            .property('value', frameCfg.value)
            .attr('step', 1);

        speedslider.property('value', frameCfg.speed);

        playtoggle.property('value', frameCfg.playing ? 'stop' : 'play')

    }

    function drawBubbles() {
        const data = marker.data;
        if (data == null) { console.log('loading'); return; }
        const sizeConfig = marker.encoding.get("size");
        const colorConfig = marker.encoding.get("color");
        const xConfig = marker.encoding.get("x");
        const yConfig = marker.encoding.get("y");
        const frameConfig = marker.encoding.get("frame");
        const selectedConfig = marker.encoding.get("selected");
        const highlightConfig = marker.encoding.get("highlighted");
        const superHighlight = marker.encoding.get("superhighlighted");

        // data join
        let update = svg.selectAll(".dot")
            .data(
                data,
                d => d[Symbol.for('key')]
            );

        // create new bubbles
        const enter = update.enter()
            .append("circle")
            .attr("class", "dot")
            .attr("id", d => d[Symbol.for('key')])
            .on("click", d => {
                if (!d[Symbol.for('trailHeadKey')]) selectedConfig.toggleSelection(d);
            })
            .on("mouseover", d => highlightConfig.addSelection(d))
            .on("mouseout", d => highlightConfig.removeSelection(d));

        // remove old bubbles
        const exit = update.exit().remove();

        // create or stop transition of update selection
        update = (frameConfig && frameConfig.playing) ?
            update.transition(getTransition(frameConfig)) :
            update.interrupt();

        // update bubble properties
        // can't use merge as you can't merge transitions and selections without losing transition
        [enter, update].map(selection => {
            selection.attr("cx", function(d) {
                    return xConfig.d3Scale(d.x);
                })
                .attr("cy", function(d) {
                    return yConfig.d3Scale(d.y);
                })
                .style("fill", function(d) {
                    return colorConfig.d3Scale(d.color);
                })
                .style('animation', d => {
                    return superHighlight.isSelected(d) ?
                        'blink 1s step-start 0s infinite' :
                        'none';
                })
                .style('zIndex', d => isHighlightedTrail(d) ? 100 : 'auto')
                .style('stroke', 'black')
                .style('stroke-width', d => isHighlightedTrail(d) ? 3 : 1)
                .style('stroke-opacity', getOpacity)
                .style('opacity', getOpacity)
                .attr("r", d => {
                    const which = sizeConfig.which;
                    const radius = isNaN(which) ? sizeConfig.d3Scale(d.size) : which;
                    return radius;
                });

        })

        // sort bubbles in data order
        svg.selectAll(".dot").order();

        function getOpacity(d) {
            const highlightOthers = 0.3;
            const selectOthers = 0.5;
            const regular = 0.8;
            const full = 1;
            const highlighted = highlightConfig.isSelected(d);
            const selected = selectedConfig.isSelected(d);
            const trail = d[Symbol.for('trailHeadKey')];

            if (highlighted || selected) return full;
            if (trail) return regular;
            if (selectedConfig.anySelected) return selectOthers;
            if (highlightConfig.anySelected) return highlightOthers;
            return regular;
        }

        function isHighlightedTrail(d) {
            const key = d[Symbol.for('trailHeadKey')] || d[Symbol.for('key')];
            return selectedConfig.isSelected(key) && highlightConfig.isSelected(d)
        }

    }

    function drawLegend() {

        const colorConfig = marker.encoding.get("color");
        const superHighlight = marker.encoding.get("superhighlighted");

        const legendEntered = svg.selectAll(".legend")
            .data(colorConfig.d3Scale.domain())
            .enter().append("g")
            .attr("class", "legend");

        legendEntered.append('text');
        legendEntered.append('rect');

        const legend = svg.selectAll(".legend");

        legend.attr("transform", function(d, i) {
            return "translate(0," + i * 20 + ")";
        });

        legend.select("rect")
            .attr("x", config.width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", colorConfig.d3Scale)
            .on("mouseover", d => {
                const values = marker.data.filter(d2 => d2["color"] == d && !d2[Symbol.for('trail')]);
                superHighlight.addSelection(values);
            })
            .on("mouseout", d => {
                const values = marker.data.filter(d2 => d2["color"] == d && !d2[Symbol.for('trail')]);
                superHighlight.removeSelection(values);
            });;

        legend.select("text")
            .attr("x", config.width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(function(d) {
                return d;
            });
    }

    function drawChart() {

        const xConfig = marker.encoding.get("x");
        const yConfig = marker.encoding.get("y");

        chart.attr("width", config.width + margin.left + margin.right)
            .attr("height", config.height + margin.top + margin.bottom)
        svg.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // var t = getTransition(frameConfig);

        xAxis.scale(xConfig.d3Scale);
        yAxis.scale(yConfig.d3Scale);
        xAxisSVG
            .attr("transform", "translate(0," + config.height + ")")
            //.transition(t)
            .call(xAxis)
        xAxisSVGtext
            .attr("x", config.width)
            .text(xConfig.which)
        yAxisSVG
        //.transition(t)
            .call(yAxis);
        yAxisSVGtext
            .text(yConfig.which)


    };

    function getTransition(frameConfig) {
        return (!frameConfig) ? d3.transition() : d3.transition()
            .duration(frameConfig.speed)
            .ease(d3.easeLinear);
    }

};