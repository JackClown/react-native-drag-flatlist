# React Native Drag FlatList

Inspired by [react-native-draggable-flatlist](https://github.com/computerjazz/react-native-draggable-flatlist).
No other dependencies.
Support typescript.

## Usage

### Props

all props will be spread onto `FlatList`

| Name         | Type                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| data         | T[]                                                                                |
| renderItem   | (params: { item: T; index: number; drag: () => void; }) => React.ReactElement<any> |
| keyExtractor | (item: T, index: number) => string                                                 |
| onMoveEnd    | (data: T[]) => void                                                                |

### Example

```javascript
import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";

import FlatList from "react-native-drag-flatlist";

const colors = ["#d3f261", "#7cb305", "#5b8c00", "#3f6600", "#254000"];

const originalData = new Array(100).fill(0).map((item, index) => ({
  text: index,
  color: colors[index % colors.length]
}));

const App = () => {
  const [data, setData] = useState(originalData);

  const keyExtractor = item => item.text.toString();

  const renderItem = ({ item, drag }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: item.color }]}
      onLongPress={drag}
    >
      <Text>{item.text}</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onMoveEnd={setData}
    />
  );
};

const styles = StyleSheet.create({
  item: {
    justifyContent: "center",
    alignItems: "center",
    width: 100,
    height: 100
  }
});

export default App;
```
