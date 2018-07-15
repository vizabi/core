import { observable, autorun, action } from 'mobx'
import * as d3 from 'd3'
import markerStore from './markerStore'
import appState from './appState'

window.d3 = d3;

chart();

function chart() {

    const config = appState;
    const marker = markerStore.get("bubbles");

    var margin = config.margin;

    var y = d3.scaleLinear();
    var color = d3.scaleOrdinal(d3.schemeCategory10);

    var xAxis = d3.axisBottom();
    var yAxis = d3.axisLeft().scale(y);

    var chart = d3.select("#chart");
    var svg = chart.append("g");
    var xAxisSVG = svg.append("g")
        .attr("class", "x axis");
    var xAxisSVGtext = xAxisSVG
        .append("text")
        .attr("class", "label")
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("Sepal Width (cm)");
    var yAxisSVG = svg.append("g")
        .attr("class", "y axis");
    var yAxisSVGtext = yAxisSVG.append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Sepal Length (cm)")

    const updateSize = action(function(e) {
        var wrap = document.getElementById("wrapper");
        appState.size.height = wrap.clientHeight;
        appState.size.width = wrap.clientWidth;
    });
    window.addEventListener("resize", updateSize);
    updateSize();

    autorun(newData);
    autorun(redrawChart);

    function newData() {

        const data = marker.frameData;
        // reset color scale
        color.domain([]);

        svg.selectAll(".dot")
            .data(
                data,
                d => d[Symbol.for('key')]
            )
            .enter().append("circle")
            .attr("class", "dot")
            .style("fill", function(d) {
                return color(d.color); // fills color domain
            });

        var legend = svg.selectAll(".legend")
            .data(color.domain())
            .enter().append("g")
            .attr("class", "legend");

        legend.append("rect");
        legend.append("text");

        y.domain(d3.extent(data, function(d) {
            return d.y;
        })).nice();

        redrawChart();
    }

    function redrawChart() {

        const sizeConfig = marker.encoding.get("size");
        const xConfig = marker.encoding.get("x");
        const frameConfig = marker.encoding.get("frame");

        y.range([config.height, 0]);

        chart.attr("width", config.width + margin.left + margin.right)
            .attr("height", config.height + margin.top + margin.bottom)
        svg.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var t = d3.transition()
            .duration(frameConfig.speed)
            .ease(d3.easeLinear);

        xAxis.scale(xConfig.d3Scale);
        xAxisSVG
            .attr("transform", "translate(0," + config.height + ")")
            .transition(t)
            .call(xAxis)
        xAxisSVGtext
            .attr("x", config.width)
        yAxisSVG
            .call(yAxis);


        svg.selectAll(".dot")
            .transition(t)
            .attr("cx", function(d) {
                return xConfig.d3Scale(d.x);
            })
            .attr("cy", function(d) {
                return y(d.y);
            })
            .style("fill", function(d) {
                return color(d.color);
            })
            .attr("r", d => {
                const which = sizeConfig.which;
                const radius = isNaN(which) ? sizeConfig.d3Scale(d.size) : which;
                return radius;
            })


        var legend = svg.selectAll(".legend")
            .attr("transform", function(d, i) {
                return "translate(0," + i * 20 + ")";
            });

        legend.select("rect")
            .attr("x", config.width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", color);

        legend.select("text")
            .attr("x", config.width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(function(d) {
                return d;
            });


    };

};