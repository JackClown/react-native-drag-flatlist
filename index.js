"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const layoutAnimConfig = {
    duration: 200,
    update: {
        type: react_native_1.LayoutAnimation.Types.linear,
        property: react_native_1.LayoutAnimation.Properties.scaleXY
    }
};
if (react_native_1.Platform.OS === "android" &&
    react_native_1.UIManager.setLayoutAnimationEnabledExperimental) {
    react_native_1.UIManager.setLayoutAnimationEnabledExperimental(true);
}
/**
 * react native drag flatlist
 * @param {boolean} [horizontal]
 * @param {T[]} data
 * @param {(item: T) => string} keyExtractor
 * @param {(data: T[]) => void} onMoveEnd
 * @param {(params: { item: T; index: number; drag: () => void }) => ReactElement<any>} renderItem
 */
class DraggableFlatList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            activeKey: null,
            hoverElement: null,
            placeholderSize: 0,
            placeholderIndex: -1
        };
        this.flatList = React.createRef();
        this.flatListNode = null;
        this.flatListContentSize = 0;
        this.container = React.createRef();
        this.containerLayout = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
        this.dragging = false;
        this.position = 0;
        this.offset = new react_native_1.Animated.Value(0);
        this.scrollOffset = 0;
        this.itemRefs = new Map();
        this.keyIndexMap = new Map();
        this.gestureState = null;
        this.move = (e, gestrueState) => {
            this.gestureState = gestrueState;
        };
        this.release = (e, { moveY, moveX }) => {
            const { activeKey } = this.state;
            if (activeKey !== null) {
                const originIndex = this.keyIndexMap.get(activeKey);
                if (originIndex === undefined) {
                    return;
                }
                const { data, keyExtractor, onMoveEnd, horizontal } = this.props;
                const { x, width, y, height } = this.containerLayout;
                const containerSize = horizontal ? width : height;
                const relativeTouchPoint = horizontal ? moveX - x : moveY - y;
                let nextIndex = -1;
                if (relativeTouchPoint >= 0 && relativeTouchPoint <= containerSize) {
                    const offset = relativeTouchPoint + this.scrollOffset;
                    if (offset >= this.flatListContentSize) {
                        nextIndex = data.length;
                    }
                    else {
                        for (let index = 0; index < data.length; index++) {
                            const item = data[index];
                            const ref = this.itemRefs.get(keyExtractor(item, index));
                            if (ref && ref.element.current && ref.layout) {
                                const { x, width, y, height } = ref.layout;
                                let start;
                                let end;
                                if (horizontal) {
                                    start = x;
                                    end = x + width;
                                }
                                else {
                                    start = y;
                                    end = y + height;
                                }
                                if (offset >= start && offset < end) {
                                    if (offset < (end + start) / 2) {
                                        nextIndex = index;
                                    }
                                    else {
                                        nextIndex = index + 1;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    if (nextIndex >= 0 && nextIndex !== originIndex) {
                        const item = data[originIndex];
                        const nextData = [...data];
                        nextData[originIndex] = undefined;
                        nextData.splice(nextIndex, 0, item);
                        const index = nextData.findIndex(item => item === undefined);
                        if (index >= 0) {
                            nextData.splice(index, 1);
                        }
                        onMoveEnd(nextData);
                    }
                }
            }
            this.dragging = false;
            this.gestureState = null;
            this.setState({
                hoverElement: null,
                activeKey: null,
                placeholderIndex: -1,
                placeholderSize: 0
            });
        };
        this.panResponder = react_native_1.PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: () => this.dragging,
            onPanResponderMove: react_native_1.Animated.event([null, { [this.props.horizontal ? "dx" : "dy"]: this.offset }], {
                listener: this.move
            }),
            onPanResponderRelease: this.release,
            onPanResponderTerminate: this.release,
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => false
        });
        this.updateRefs = (data) => {
            const { keyExtractor } = this.props;
            data.forEach((item, index) => {
                const key = keyExtractor(item, index);
                if (!this.itemRefs.has(key)) {
                    this.itemRefs.set(key, { element: React.createRef() });
                }
                this.keyIndexMap.set(key, index);
            });
        };
        this.layoutContainer = () => {
            if (this.container.current) {
                this.container.current.measureInWindow((x, y, width, height) => {
                    this.containerLayout = {
                        x,
                        y,
                        width,
                        height
                    };
                });
            }
        };
        this.drag = (hoverElement, key) => {
            var _a;
            const item = this.itemRefs.get(key);
            if (item && item.layout) {
                const { horizontal } = this.props;
                const { x, width, y, height } = item.layout;
                this.dragging = true;
                this.offset.setValue(0);
                this.position = (horizontal ? x : y) - this.scrollOffset;
                this.setState({
                    hoverElement,
                    activeKey: key,
                    placeholderIndex: (_a = this.keyIndexMap.get(key), (_a !== null && _a !== void 0 ? _a : -1)),
                    placeholderSize: horizontal ? width : height
                }, () => {
                    this.animate();
                });
            }
        };
        this.handleScroll = ({ nativeEvent: { contentOffset: { x, y } } }) => {
            const { horizontal } = this.props;
            this.scrollOffset = horizontal ? x : y;
        };
        this.renderItem = ({ item, index }) => {
            const { keyExtractor, renderItem, horizontal } = this.props;
            const { placeholderSize, placeholderIndex, activeKey } = this.state;
            const key = keyExtractor(item, index);
            const ref = this.itemRefs.get(key);
            // 部分机型系统上，行元素在形状不发生改变的情况下交换位置后不会触发onLayout导致layout错误，这种方式会导致元素交换位置后重新创建，因为会触发onLayout，但是性能会下降
            return key === activeKey && placeholderIndex !== index ? null : (<react_native_1.View style={[
                horizontal ? styles.horizontal : styles.vertical,
                key === activeKey ? { opacity: 0 } : undefined
            ]}>
        <react_native_1.View key={key + "-" + index} onLayout={() => this.layout(key)} ref={ref ? ref.element : undefined} style={react_native_1.StyleSheet.absoluteFill}/>
        <react_native_1.View style={key !== activeKey && placeholderIndex === index
                ? { [horizontal ? "width" : "height"]: placeholderSize }
                : undefined}/>
        <Row item={item} itemKey={key} index={index} renderItem={renderItem} drag={this.drag}/>
      </react_native_1.View>);
        };
        this.renderHoverElement = (hoverElement) => {
            const { horizontal } = this.props;
            if (hoverElement) {
                return (<react_native_1.Animated.View style={[
                    horizontal
                        ? styles.hoverElementHorizontal
                        : styles.hoverElementVertical,
                    {
                        [horizontal ? "left" : "top"]: this.position,
                        transform: [
                            {
                                [horizontal ? "translateX" : "translateY"]: this.offset
                            }
                        ]
                    }
                ]}>
          {hoverElement}
        </react_native_1.Animated.View>);
            }
            else {
                return null;
            }
        };
        this.handleContentSizeChange = (w, h) => {
            const { horizontal } = this.props;
            this.flatListContentSize = horizontal ? w : h;
        };
        this.updateRefs(props.data);
    }
    componentDidMount() {
        this.flatListNode = react_native_1.findNodeHandle(this.flatList.current);
    }
    componentDidUpdate(prevProps) {
        const { data } = this.props;
        if (data !== prevProps.data) {
            this.updateRefs(data);
        }
    }
    layout(key) {
        if (this.itemRefs.has(key)) {
            const item = this.itemRefs.get(key);
            if (this.flatListNode && item.element.current) {
                item.element.current.measureLayout(this.flatListNode, (x, y, width, height) => {
                    item.layout = {
                        x,
                        y,
                        width,
                        height
                    };
                }, () => {
                    console.log("measure item layout failed");
                });
            }
        }
    }
    animate() {
        if (this.gestureState && this.flatList.current) {
            const { horizontal } = this.props;
            const { x, width, y, height } = this.containerLayout;
            const { moveX, vx, moveY, vy } = this.gestureState;
            const containerSize = horizontal ? width : height;
            const relativeTouchPoint = horizontal ? moveX - x : moveY - y;
            const velocity = horizontal ? vx : vy;
            if (relativeTouchPoint >= 0 && relativeTouchPoint <= height) {
                let offset = this.scrollOffset;
                if (relativeTouchPoint <= containerSize * 0.05 &&
                    this.scrollOffset > 0) {
                    offset -= 5;
                }
                else if (relativeTouchPoint >= containerSize * 0.95 &&
                    this.flatListContentSize - this.scrollOffset > containerSize) {
                    offset += 5;
                }
                else if (Math.abs(velocity) <= 0.05) {
                    const point = offset + relativeTouchPoint;
                    let index = -1;
                    for (let [key, item] of this.itemRefs) {
                        if (item.element.current && item.layout) {
                            const { x, width, y, height } = item.layout;
                            let start;
                            let end;
                            if (horizontal) {
                                start = x;
                                end = x + width;
                            }
                            else {
                                start = y;
                                end = y + height;
                            }
                            if (point >= start && point < end) {
                                index = this.keyIndexMap.get(key);
                                if (point >= (start + end) / 2) {
                                    index += 1;
                                }
                                break;
                            }
                        }
                    }
                    if (index >= 0 && index !== this.state.placeholderIndex) {
                        react_native_1.LayoutAnimation.configureNext(layoutAnimConfig);
                        this.setState({ placeholderIndex: index });
                    }
                }
                if (offset !== this.scrollOffset) {
                    this.flatList.current.scrollToOffset({ offset, animated: false });
                }
            }
        }
        if (this.dragging) {
            requestAnimationFrame(this.animate.bind(this));
        }
    }
    render() {
        const { data, keyExtractor, horizontal } = this.props;
        const { hoverElement } = this.state;
        return (<react_native_1.View style={styles.container} ref={this.container} onLayout={this.layoutContainer} {...this.panResponder.panHandlers}>
        <react_native_1.FlatList data={data} ref={this.flatList} horizontal={horizontal} renderItem={this.renderItem} extraData={this.state} onContentSizeChange={this.handleContentSizeChange} keyExtractor={keyExtractor} scrollEventThrottle={1} onScroll={this.handleScroll}/>
        {this.renderHoverElement(hoverElement)}
      </react_native_1.View>);
    }
}
exports.default = DraggableFlatList;
class Row extends React.PureComponent {
    constructor() {
        super(...arguments);
        this.drag = () => {
            const { drag, renderItem, item, itemKey, index } = this.props;
            const hoverElement = renderItem({
                item,
                index,
                drag: () => console.log("## attempt to call drag() on hovering component")
            });
            drag(hoverElement, itemKey);
        };
    }
    render() {
        const { renderItem, item, index } = this.props;
        return renderItem({
            item,
            index,
            drag: this.drag
        });
    }
}
exports.Row = Row;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1
    },
    hoverElementVertical: {
        position: "absolute",
        left: 0,
        right: 0,
        zIndex: 1
    },
    hoverElementHorizontal: {
        position: "absolute",
        bottom: 0,
        top: 0,
        zIndex: 1
    },
    horizontal: {
        flexDirection: "row"
    },
    vertical: {
        flexDirection: "column"
    }
});
