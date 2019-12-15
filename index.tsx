import * as React from "react";
import {
  UIManager,
  StyleSheet,
  FlatListProps,
  View,
  Animated,
  FlatList,
  findNodeHandle,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutAnimation,
  Platform
} from "react-native";

const layoutAnimConfig = {
  duration: 200,
  update: {
    type: LayoutAnimation.Types.linear,
    property: LayoutAnimation.Properties.scaleXY
  }
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props<T>
  extends Omit<FlatListProps<T>, "renderItem" | "keyExtractor"> {
  horizontal?: boolean;
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onMoveEnd: (data: T[]) => void;
  renderItem: (params: {
    item: T;
    index: number;
    drag: () => void;
  }) => React.ReactElement<any>;
  autoscrollThreshold: number;
}

interface State {
  activeIndex: number;
  hoverElement: React.ReactElement<any> | null;
  placeholderIndex: number;
  placeholderSize: number;
}

/**
 * react native drag flatlist
 * @param {number} [autoscrollThreshold]
 * @param {boolean} [horizontal]
 * @param {T[]} data
 * @param {(item: T) => string} keyExtractor
 * @param {(data: T[]) => void} onMoveEnd
 * @param {(params: { item: T; index: number; drag: () => void }) => ReactElement<any>} renderItem
 */

class DraggableFlatList<T> extends React.Component<Props<T>, State> {
  static defaultProps = {
    autoscrollThreshold: 0.05
  };

  public state: State = {
    activeIndex: -1,
    hoverElement: null,
    placeholderSize: 0,
    placeholderIndex: -1
  };

  private dragging = false;

  private flatList = React.createRef<FlatList<T>>();

  private flatListNode: number | null = null;

  private flatListContentSize: number = 0;

  private container = React.createRef<View>();

  private containerSize: number = 0;

  private containerOffset: number = 0;

  private position: number = 0;

  private offset = new Animated.Value(0);

  private scrollOffset = 0;

  private itemRefs: Map<
    string,
    {
      element: React.RefObject<View>;
      layout?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }
  > = new Map();

  private gestureState: PanResponderGestureState | null = null;

  private move = (
    e: GestureResponderEvent,
    gestrueState: PanResponderGestureState
  ) => {
    this.gestureState = gestrueState;
  };

  private getPlaceIndex(offset: number) {
    const { data, keyExtractor, horizontal } = this.props;
    let nextIndex = -1;

    for (let index = 0; index < data.length; index++) {
      const item = data[index];

      const ref = this.itemRefs.get(keyExtractor(item, index));

      if (ref && ref.element.current && ref.layout) {
        const { x, width, y, height } = ref.layout;
        let start: number;
        let end: number;

        if (horizontal) {
          start = x;
          end = x + width;
        } else {
          start = y;
          end = y + height;
        }

        if (offset >= start && offset < end) {
          nextIndex = index;

          if (offset >= (start + end) / 2) {
            nextIndex += 1;
          }

          break;
        }
      }
    }

    return nextIndex;
  }

  private release = (
    e: GestureResponderEvent,
    { moveY, moveX }: PanResponderGestureState
  ) => {
    const { activeIndex } = this.state;

    if (activeIndex >= 0) {
      const { data, onMoveEnd, horizontal } = this.props;
      const relativeTouchPoint =
        (horizontal ? moveX : moveY) - this.containerOffset;

      if (relativeTouchPoint >= 0 && relativeTouchPoint <= this.containerSize) {
        const offset = relativeTouchPoint + this.scrollOffset;
        let nextIndex = -1;

        if (offset >= this.flatListContentSize) {
          nextIndex = data.length;
        } else {
          nextIndex = this.getPlaceIndex(offset);
        }

        if (nextIndex >= 0 && nextIndex !== activeIndex) {
          const item = data[activeIndex];
          const nextData: (T | undefined)[] = [...data];

          nextData[activeIndex] = undefined;
          nextData.splice(nextIndex, 0, item);

          const index = nextData.findIndex(item => item === undefined);

          if (index >= 0) {
            nextData.splice(index, 1);
          }

          onMoveEnd(nextData as T[]);
        }
      }
    }

    this.dragging = false;
    this.gestureState = null;

    this.setState({
      hoverElement: null,
      activeIndex: -1,
      placeholderIndex: -1,
      placeholderSize: 0
    });
  };

  private panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => this.dragging,
    onPanResponderMove: Animated.event(
      [null, { [this.props.horizontal ? "dx" : "dy"]: this.offset }],
      {
        listener: this.move as any
      }
    ),
    onPanResponderRelease: this.release,
    onPanResponderTerminate: this.release,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false
  });

  private updateRefs = (data: T[]) => {
    const { keyExtractor } = this.props;

    data.forEach((item, index) => {
      const key = keyExtractor(item, index);

      if (!this.itemRefs.has(key)) {
        this.itemRefs.set(key, { element: React.createRef() });
      }
    });
  };

  constructor(props: Props<T>) {
    super(props);

    this.updateRefs(props.data);
  }

  public componentDidMount() {
    this.flatListNode = findNodeHandle(this.flatList.current);
  }

  public componentDidUpdate(prevProps: Props<T>) {
    const { data } = this.props;

    if (data !== prevProps.data) {
      this.updateRefs(data);
    }
  }

  private layout(key: string) {
    if (this.itemRefs.has(key)) {
      const item = this.itemRefs.get(key)!;

      if (this.flatListNode && item.element.current) {
        item.element.current.measureLayout(
          this.flatListNode,
          (x: number, y: number, width: number, height: number) => {
            item.layout = {
              x,
              y,
              width,
              height
            };
          },
          () => {
            console.log("measure item layout failed");
          }
        );
      }
    }
  }

  private layoutContainer = () => {
    if (this.container.current) {
      this.container.current.measureInWindow(
        (x: number, y: number, width: number, height: number) => {
          const { horizontal } = this.props;

          if (horizontal) {
            this.containerSize = width;
            this.containerOffset = x;
          } else {
            this.containerSize = height;
            this.containerOffset = y;
          }
        }
      );
    }
  };

  private drag = (
    hoverElement: React.ReactElement<any>,
    key: string,
    index: number
  ) => {
    const item = this.itemRefs.get(key);

    if (item && item.layout) {
      const { horizontal } = this.props;
      const { x, width, y, height } = item.layout;

      this.dragging = true;
      this.offset.setValue(0);
      this.position = (horizontal ? x : y) - this.scrollOffset;
      this.setState(
        {
          hoverElement,
          activeIndex: index,
          placeholderIndex: index,
          placeholderSize: horizontal ? width : height
        },
        () => {
          this.animate();
        }
      );
    }
  };

  private animate() {
    if (this.gestureState && this.flatList.current) {
      const { horizontal, autoscrollThreshold } = this.props;
      const { moveX, vx, moveY, vy } = this.gestureState;

      let relativeTouchPoint, velocity;

      if (horizontal) {
        relativeTouchPoint = moveX - this.containerOffset;
        velocity = vx;
      } else {
        relativeTouchPoint = moveY - this.containerOffset;
        velocity = vy;
      }

      if (relativeTouchPoint >= 0 && relativeTouchPoint <= this.containerSize) {
        let offset = this.scrollOffset;

        if (
          relativeTouchPoint <= this.containerSize * autoscrollThreshold &&
          this.scrollOffset > 0
        ) {
          offset -= 5;
        } else if (
          relativeTouchPoint >=
            this.containerSize * (1 - autoscrollThreshold) &&
          this.flatListContentSize - this.scrollOffset > this.containerSize
        ) {
          offset += 5;
        } else if (Math.abs(velocity) <= 0.05) {
          let index = this.getPlaceIndex(offset + relativeTouchPoint);

          if (index >= 0 && index !== this.state.placeholderIndex) {
            LayoutAnimation.configureNext(layoutAnimConfig);

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

  private handleScroll = ({
    nativeEvent: {
      contentOffset: { x, y }
    }
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { horizontal } = this.props;
    this.scrollOffset = horizontal ? x : y;
  };

  private renderItem = ({ item, index }: { item: T; index: number }) => {
    const { keyExtractor, renderItem, horizontal } = this.props;
    const { placeholderSize, placeholderIndex, activeIndex } = this.state;

    const key = keyExtractor(item, index);

    const ref = this.itemRefs.get(key);

    // 部分机型系统上，行元素在形状不发生改变的情况下交换位置后不会触发onLayout导致layout错误，这种方式会导致元素交换位置后重新创建，因为会触发onLayout，但是性能会下降
    return activeIndex === index && placeholderIndex !== index ? null : (
      <View
        style={[
          horizontal ? styles.horizontal : styles.vertical,
          activeIndex === index ? { opacity: 0 } : undefined
        ]}
      >
        <View
          key={key + "-" + index}
          onLayout={() => this.layout(key)}
          ref={ref ? ref.element : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={
            activeIndex !== index && placeholderIndex === index
              ? { [horizontal ? "width" : "height"]: placeholderSize }
              : undefined
          }
        />
        <Row
          item={item}
          itemKey={key}
          index={index}
          renderItem={renderItem}
          drag={this.drag}
        />
      </View>
    );
  };

  private renderHoverElement = (
    hoverElement: React.ReactElement<any> | null
  ) => {
    const { horizontal } = this.props;

    if (hoverElement) {
      return (
        <Animated.View
          style={[
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
          ]}
        >
          {hoverElement}
        </Animated.View>
      );
    } else {
      return null;
    }
  };

  private handleContentSizeChange = (w: number, h: number) => {
    const { horizontal } = this.props;
    this.flatListContentSize = horizontal ? w : h;
  };

  public render() {
    const { data, keyExtractor, horizontal } = this.props;
    const { hoverElement } = this.state;

    return (
      <View
        style={styles.container}
        ref={this.container}
        onLayout={this.layoutContainer}
        {...this.panResponder.panHandlers}
      >
        <FlatList
          data={data}
          ref={this.flatList}
          horizontal={horizontal}
          renderItem={this.renderItem}
          extraData={this.state}
          onContentSizeChange={this.handleContentSizeChange}
          keyExtractor={keyExtractor}
          scrollEventThrottle={1}
          onScroll={this.handleScroll}
        />
        {this.renderHoverElement(hoverElement)}
      </View>
    );
  }
}

export default DraggableFlatList;

interface RowProps<T> {
  drag: (
    hoverElement: React.ReactElement<any>,
    itemKey: string,
    index: number
  ) => void;
  item: T;
  itemKey: string;
  index: number;
  renderItem: Props<T>["renderItem"];
}

export class Row<T> extends React.PureComponent<RowProps<T>> {
  private drag = () => {
    const { drag, renderItem, item, itemKey, index } = this.props;
    const hoverElement = renderItem({
      item,
      index,
      drag: () => console.log("## attempt to call drag() on hovering component")
    });
    drag(hoverElement, itemKey, index);
  };

  public render() {
    const { renderItem, item, index } = this.props;

    return renderItem({
      item,
      index,
      drag: this.drag
    });
  }
}

const styles = StyleSheet.create({
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
