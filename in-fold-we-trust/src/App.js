import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
    configFromSequence, linkLocationGen,
    aminos, findPossibleRotation, findMapNeighbours,
    getFoldingIndicators, gridFromCoordMap
} from './foldUtils.js';
import './App.css';

/* 
   -- Terminology
   Amino / AminoAcid / AA = the colourful circles
   HP / Hydrophobic vs Polar = whether the AA needs to be inside or outside
   FoldingIndicators = blue squares on which the user clicks to chose his folding direction
*/


class App extends Component {
    render() {
	return (
	    <div id="wrapper">
	      <FoldingBoard gridSize={this.props.gridSize} aminoString={aminos}/>
	    </div>
	);
    }
}


class FoldingBoard extends Component {
    // The actual board where the folding happens
    constructor(props) {
	super(props);
	
	this.createGrid = this.createGrid.bind(this);
	this.aminoClick = this.aminoClick.bind(this);
	this.generateFoldingIndicators = this.generateFoldingIndicators.bind(this);
	this.foldingIndicatorClick = this.foldingIndicatorClick.bind(this);
	this.resetToNormalState = this.resetToNormalState.bind(this);
	
	let r = configFromSequence(this.props.aminoString);
	this.state = {
	    // a Map object with the structure:
	    // { aminoCoords -> HP-property } (either "H" or "P")
	    aminoCoordMap: r[0],
	    // a 2d array to represent the board (only aminos inside)
	    grid: r[1],
	    // a Map object with the structure: { foldingIndicatorCoords -> rotation }
	    // (either +1 or -1) (sens trigonometrique)
 	    foldingIndicators: new Map(),
	    // the possible rotations, this is only used in the phase "chooseDirection"
	    // structure: { direction -> resultingAminoCoordMap }  (after rotation)
	    currentPossibleRotations: new Map(),
	    // the current step in which the board is
	    // "normal": if the user selected nothing
	    // "chooseRotation": if the user has chosen an origin and is chosing the rotation point
	    // "chooseDirection": the user is choosing the rotation direction
	    foldingStep: "normal",
	    selectedAmino: "",  // coords are as string, "x-y"
	    rotationAmino: ""
	};
    }


    aminoClick(coords) {
	// This is the callback function when an amino is clicked
	if (this.state.foldingStep === "normal") {
	    // selected origin
	    this.setState({
		selectedAmino: coords,
		foldingStep: "chooseRotation"
	    });
	} else if (this.state.foldingStep === "chooseRotation") {
	    // selected rotationAmino
	    // find the neighbours of this amino on the chain
	    let neighbourAminos = findMapNeighbours(
		this.state.aminoCoordMap, this.state.selectedAmino
	    );
	    console.log(neighbourAminos);
	    console.log(neighbourAminos.includes(coords));
	    if (coords === this.state.selectedAmino) {
		alert("You must select a different amino\nTODO make that a better dialog");
	    } else if (neighbourAminos.includes(coords) === false) {
		alert("You must select a rotation point adjacent to this amino in the chain");
	    } else {
		this.setState({
		    rotationAmino: coords,
		    foldingStep: "chooseDirection"
		}, this.generateFoldingIndicators);
	    }
	}
    }

    generateFoldingIndicators() {
	// This function generates the positions of the foldingIndicators
	// after the user has chose origin and rotation point
	let possibleRotations = new Map([-1, 1].map((direction) => [direction, findPossibleRotation(
	    this.state.aminoCoordMap,
	    this.state.selectedAmino,
	    this.state.rotationAmino,
	    direction,
	    this.state.grid.length
	)]));
	
	// generate the positions for folding indicators
	let positions = getFoldingIndicators(
	    this.state.selectedAmino, this.state.rotationAmino,
	    this.state.grid.length, possibleRotations
	);
	
	if (positions.size === 0) {
	    // there are no possible positions for foldingIndicator
	    // which implies there are no legal rotations
	    this.resetToNormalState();
	} else {
	    // fold!
	    this.setState({
		foldingIndicators: positions,
		currentPossibleRotations: possibleRotations
	    });
	}
    }

    foldingIndicatorClick(direction) {
	// Called when a foldingIndicator is clicked
	let newAminos = this.state.currentPossibleRotations.get(direction);
	this.setState({
	    aminoCoordMap: newAminos,
	    grid: gridFromCoordMap(newAminos, this.state.grid.length)
	}, this.resetToNormalState);  // we reset to normal mode
    }

    resetToNormalState() {
	// this function is called when an operation is finished or aborted
	this.setState({
	    foldingIndicators: new Map(),
	    currentPossibleRotations: new Map(),
	    foldingStep: "normal",
	    selectedAmino: "",
	    rotationAmino: ""
	});
    }
    
    createGrid(gridSize) {
	// creates the folding board grid
	let result = [];
	let joins = linkLocationGen(this.state.aminoCoordMap);
	let tdFactory = (y, gridSize) => {
	    return [...Array(gridSize*2 - 1)].map((_, x) => {
		let tds = [];
		if ((y % 2 === 0) && (x % 2 === 0)) {
		    // checking if there is an AA at this location of the grid
		    let gridElementAtPos = this.state.grid[x/2][y/2];
		    // checking if the aa is active
		    let isActive = false;
		    if (this.state.selectedAmino === x/2 + "-" + y/2) {
			isActive = true;
		    }
		    // checking if there is a foldingIndicator
		    let foldingIndicatorDirection = this.state.foldingIndicators.get(x/2 + "-" + y/2);
		    tds.push(
			<AminoAcidCell key={"" + x + y} hp={gridElementAtPos}
				       foldingIndicatorDirection={foldingIndicatorDirection}
				       coords={x/2 + "-" + y/2}
				       aminoClickCallback={this.aminoClick} isActive={isActive}
				       indicatorClickCallback={this.foldingIndicatorClick}/>
		    );
		} else if ((x % 2) !== (y % 2)) {  // its a link cell
		    let orientationClass = (y % 2 === 0) ? "wide" : "tall";
		    let singleLink;
		    
		    if (orientationClass === "wide") {
 			singleLink = [[(x-1)/2, y/2].join("-"), [(x+1)/2, y/2].join("-")];
		    } else {
			singleLink = [[x/2, (y-1)/2].join("-"), [x/2, (y+1)/2].join("-")];
		    }
		    // check if the link should be coloured
		    let linkIsActive = joins.includes(singleLink.join("--"))
			|| joins.includes([...singleLink].reverse().join("--"));

		    tds.push( // TODO: shrink the links
			    <div key={"" + x + y} className={["td", "aa-link", orientationClass].join(" ")}>  
			    <div className={["link", linkIsActive ? "active" : ""].join(" ")}/>
			    </div>
		    );
		} else {
		    tds.push(<div key={"" + x + y} className="td empty"></div>);
		}
		return tds;
	    });
	};

	for (let y = 0; y < gridSize*2 - 1; y++) {
	    result.push(
		<div key={"row" + y} className="tr">
		  {tdFactory(y, gridSize)}
		</div>
	    );
	}
	return result;
    }
    
    render() {
	return this.createGrid(10);
    }
}

FoldingBoard.propTypes = {
    gridSize: PropTypes.number.isRequired,
    aminoString: PropTypes.string.isRequired
};


class AminoAcidCell extends Component {
    // a Cell can be empty or have an AA
    generateCellContent() {
	let cellContent = undefined;
	// we check if there is an aa through the hp prop
	if (this.props.hp !== undefined) {
	    cellContent =
		<AminoAcid isActive={this.props.isActive}
	                   hp={this.props.hp} coords={this.props.coords}
	                   aminoClickCallback={this.props.aminoClickCallback}/>;
	} else if (this.props.foldingIndicatorDirection !== undefined) {
	    // there might also be a foldingIndicator if there is no AA
	    cellContent =
		<FoldingIndicator direction={this.props.foldingIndicatorDirection}
	                          indicatorClickCallback={this.props.indicatorClickCallback}/>;
	}
	return cellContent;
    }

    render() {
	return (
	    <div className={["td", "aa-cell", this.props.isActive ? "active" : ""].join(" ")}>
	      {this.generateCellContent.bind(this)()}
	    </div>
	);
    }
}

AminoAcidCell.propTypes = {
    coords: PropTypes.string.isRequired,
    isActive: PropTypes.bool.isRequired,
    hp: PropTypes.string,
    aminoClickCallback: PropTypes.func,
    indicatorClickCallback: PropTypes.func,
    foldingIndicatorDirection: PropTypes.number
};


class AminoAcid extends Component {
    render() {
        return (
	    <div className={["aa", this.props.hp].join(" ")}
		 onClick={() => this.props.aminoClickCallback(this.props.coords)}>
            </div>
	);
    }
}

AminoAcid.propTypes = {
    isActive: PropTypes.bool.isRequired,
    coords: PropTypes.string.isRequired,
    hp: PropTypes.string.isRequired,
    aminoClickCallback: PropTypes.func.isRequired
};


class FoldingIndicator extends Component {
    render() {
	return (
	    <div className="folding-indicator"
		 onClick={() => this.props.indicatorClickCallback(this.props.direction)}/>
	);
    }
}

FoldingIndicator.propTypes = {
    direction: PropTypes.number.isRequired,  // either +1 or -1
    indicatorClickCallback: PropTypes.func.isRequired
};

export default App;
