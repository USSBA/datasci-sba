import React from 'react'
import { connect } from 'react-redux'

import {getGeometry, getRegions, setMousedRegionId} from '../../redux/regions'
import {getColorField, getColorQuantiler, getNumColorQuantiles} from '../../redux/color'
import {getFilterField, getFilterRange} from '../../redux/filter'


/**
 * React component that renders the map with colored regions.  Basically a wrapper around the GoogleMap API.
 * 
 * We don't really use React's lifecycle here; instead we depend on GoogleMap's internal update cycle.
 * Thus our React render method is just a div, and the real work happens in componentDidMount (for
 * initialization) and componentDidUpdate (to do the rendering when the state has changed)
 */
class GoogleMap extends React.Component {

  /**
   * called by React after the DOM element is first added to the page; we use this to
   * initialize the Google Map insteance
   */
  componentDidMount() {
    this.map = new google.maps.Map(document.getElementById('map'), googleMapOptions);

    this.map.data.setStyle(feature => styleFeature(feature, this.props))
    this.map.data.addListener('mouseover', e => {
      e.feature.setProperty('state', 'hover')
      this.props.onMouseover(e.feature.getId())
    })
    this.map.data.addListener('mouseout', e => {
      e.feature.setProperty('state', 'normal')
      this.props.onMouseover(undefined)
    })
  }


  /**
   * called by React after each props/state update; we use this to tell Google Maps to re-render
   */
  componentDidUpdate(prevProps) {

    // for performance reasons, only update the features' geometry if it has changed
    if(prevProps.geometry !== this.props.geometry) {
      this.map.data.forEach((feature) => this.map.data.remove(feature))
      this.map.data.addGeoJson(this.props.geometry, { idPropertyName: 'GEOID10' })
    }

    // recolor all features
    this.map.data.forEach((feature) => {

      let region = this.props.regions[feature.getId()]
      if(region) {
        const colorVariable = region[this.props.colorField]
        const filterVariable = region[this.props.filterField]

        if(this.props.filterRange[0] <= filterVariable && filterVariable <= this.props.filterRange[1]) {
          feature.setProperty('colorVariable', colorVariable);    
        } else {
          feature.setProperty('colorVariable', undefined)
        }
      }
    })
  }



  render() {
    return <div id="map"/>
  }
}


const mapStateToProps = state => ({
  geometry: getGeometry(state),
  regions: getRegions(state),
  colorField: getColorField(state),
  colorQuantiler: getColorQuantiler(state),
  numColorQuantiles: getNumColorQuantiles(state),
  filterField: getFilterField(state),
  filterRange: getFilterRange(state)
})

const mapDispatchToProps = {
  onMouseover: setMousedRegionId
}


export default connect(mapStateToProps, mapDispatchToProps)(GoogleMap)








/////////////////////// Supporting styles/options for Google Maps API //////////////////////////

/*
 * These are some constants used by the GoogleMaps component above to style the map
 */


/**
 * Applies a gradient style based on the colorField.
 * This is the callback passed to data.setStyle() and is called for each row in
 * the data set.  Check out the docs for Data.StylingFunction.
 *
 * @param {google.maps.Data.Feature} feature
 * @param {Object} props the current props on the GoogleMap component
 */
function styleFeature(feature, props) {

  // TODO: don't use a red/green color scheme!  use viridis instead?

  var low = [5, 69, 54];  // color of smallest datum
  var high = [151, 83, 34];   // color of largest datum

  // delta represents where the value sits between the min and max
  let quantile = props.colorQuantiler.getQuantile(feature.getProperty('colorVariable'))

  var color = [];
  for (var i = 0; i < 3; i++) {
    // calculate an integer color based on the delta
    color[i] = (high[i] - low[i]) * quantile / (props.numColorQuantiles - 1) + low[i];
  }

  // determine whether to show this shape or not
  var showRow = true;
  if (feature.getProperty('colorVariable') == null ||
      isNaN(feature.getProperty('colorVariable'))) {
    showRow = false;
  }

  var outlineWeight = 0.5, zIndex = 1;
  if (feature.getProperty('state') === 'hover') {
    outlineWeight = zIndex = 2;
  }

  return {
    strokeWeight: outlineWeight,
    strokeColor: '#fff',
    zIndex: zIndex,
    fillColor: 'hsl(' + color[0] + ',' + color[1] + '%,' + color[2] + '%)',
    fillOpacity: 0.75,
    visible: showRow
  };
}


const googleMapOptions = {
  center: {lat: 40, lng: -123},
  zoom: 7,
  styles: [{
      'stylers': [{'visibility': 'off'}]
    }, {
      'featureType': 'road.highway',
      'stylers': [{'visibility': 'simplified'}]
    }, {
      'featureType': 'administrative',
      'stylers': [{'visibility': 'on'}]
    }, {
      'featureType': 'water',
      'elementType': 'geometry',
      'stylers': [{'visibility': 'simplified'}]
    }
  ]
}