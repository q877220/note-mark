# HTML页面布局

- &lt;main&gt; 存放每个页面独有的内容。每个页面上只能用一次 &lt;main&gt;，且直接位于 &lt;body&gt; 中。最好不要把它嵌套进其它元素。
- &lt;article&gt; 包围的内容即一篇文章，与页面其它部分无关（比如一篇博文）。
- &lt;section&gt; 与 &lt;article&gt; 类似，但 &lt;section&gt; 更适用于组织页面使其按功能（比如迷你地图、一组文章标题和摘要）分块。一般的最佳用法是：以 标题 作为开头；也可以把一篇 &lt;article&gt; 分成若干部分并分别置于不同的 &lt;section&gt; 中，也可以把一个区段 &lt;section&gt; 分成若干部分并分别置于不同的 &lt;article&gt; 中，取决于上下文。
- &lt;aside&gt; 包含一些间接信息（术语条目、作者简介、相关链接，等等）。
- &lt;header&gt; 是简介形式的内容。如果它是 &lt;body&gt; 的子元素，那么就是网站的全局页眉。如果它是 &lt;article&gt; 或&lt;section&gt; 的子元素，那么它是这些部分特有的页眉（此 &lt;header&gt; 非彼 标题）。
- &lt;nav&gt; 包含页面主导航功能。其中不应包含二级链接等内容。包含页面主导航功能。其中不应包含二级链接等内容。
- &lt;footer&gt; 包含了页面的页脚部分。

