---
id: container
title: Container
---

Containers are used to group components together. You can move the desired number of components inside a container to organize your app better.

:::caution Restricted components
In order to avoid excessively complex situations, certain components, namely **Calendar** and **Kanban**, are restricted from being placed within the Container component using drag-and-drop functionality.

If the builder attempts to add any of the aforementioned components inside the container, an error message will be displayed:

`<Restricted component> cannot be used as a child component within the container.`
:::

<div style={{paddingTop:'24px'}}>

## Enabling Vertical Scroll on Container

To enable the vertical scroll on the container, drag and place any component to the bottom grid of the container and the container will automatically enable the scrolling.

</div>

<div style={{paddingTop:'24px'}}>

## Loading State

To activate the loader on the Container component, access its properties and dynamically adjust the **Loading State** property by clicking the **fx** button. You can set it to either `{{true}}` or `{{false}}`.

For instance, if you wish to display the loader on the container when the query named `restapi1` is in progress, set the **Loading State** value to `{{queries.restapi1.isLoading}}`.

</div>

<div style={{paddingTop:'24px'}}>

## Component Specific Actions (CSA)

There are currently no CSA (Component-Specific Actions) implemented to regulate or control the component.

</div>

<div style={{paddingTop:'24px'}}>

## Exposed Variables

There are currently no exposed variables for the component.

</div>

<div style={{paddingTop:'24px'}}>

## General
### Tooltip

A Tooltip is often used to specify extra information about something when the user hovers the mouse pointer over the component.

Under the **General** accordion, you can set the value in the string format. Now hovering over the component will display the string as the tooltip.

</div>

<div style={{paddingTop:'24px'}}>

## Layout

| <div style={{ width:"100px"}}> Layout </div> | <div style={{ width:"100px"}}> Description </div> |
|:----------- |:----------- |
| Show on desktop | Makes the component visible in desktop view. | You can set it with the toggle button or dynamically configure the value by clicking on **fx** and entering a logical expression. |
| Show on mobile | Makes the component visible in mobile view.| You can set it with the toggle button or dynamically configure the value by clicking on **fx** and entering a logical expression. |

</div>

---

<div style={{paddingTop:'24px'}}>

## Styles

| <div style={{ width:"100px"}}> Style </div> | <div style={{ width:"100px"}}> Description </div> | <div style={{ width:"100px"}}> Default Value </div> |
|:----------- |:----------- |:---------|
| Background color |  Change the background color of the Container by entering the `Hex color code` or choosing a color of your choice from the color picker. | |
| Border radius | Modifies the border radius of the container. The field expects only numerical values from `1` to `100`.| Default is `0`. |
| Border color |  Change the border color of the Container by entering the `Hex color code` or choosing a color of your choice from the color picker. | |
| Visibility | Controls the visibility of the component. If `{{false}}` the component will not be visible after the app is deployed. It can only have boolean values i.e. either `{{true}}` or `{{false}}`. | By default, it's set to `{{true}}`. |
| Disable |  This property only accepts boolean values. If set to `{{true}}`, the component will be locked and becomes non-functional. | By default, its value is set to `{{false}}`. |


:::info
Any property having **fx** button next to its field can be **programmatically configured**.
:::

</div>
