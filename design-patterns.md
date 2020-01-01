# [设计模式](https://github.com/sohamkamani/javascript-design-patterns-for-humans)
## 创建类
- 单例: 一般不使用这种设计模式，因为整个应用共享一个实例，整个代码紧耦合，并且发现bug时不易调试
- 简单工厂: 当创建一个复杂的对象时使用这种方式，而不是到处遍布类同的代码
- 工厂方法: 类似于多态，基类的方法根据不同的子类有不同的行为
- 抽象工厂: 简单工厂的整合，多个简单工厂类合并为一个抽象工厂
- 构建: 当构造函数有多个参数时一般会整合为一个对象。这种设计模式与工厂模式的差异是，该模式多个参数逐步创建，而工厂模式是一次性创建。
```
lass Burger {
    constructor(builder) {
        this.size = builder.size
        this.cheeze = builder.cheeze || false
        this.pepperoni = builder.pepperoni || false
        this.lettuce = builder.lettuce || false
        this.tomato = builder.tomato || false
    }
}

And then we have the builder

class BurgerBuilder {

    constructor(size) {
        this.size = size
    }

    addPepperoni() {
        this.pepperoni = true
        return this
    }

    addLettuce() {
        this.lettuce = true
        return this
    }

    addCheeze() {
        this.cheeze = true
        return this
    }

    addTomato() {
        this.tomato = true
        return this
    }

    build() {
        return new Burger(this)
    }
}

And then it can be used as:

const burger = (new BurgerBuilder(14))
    .addPepperoni()
    .addLettuce()
    .addTomato()
    .build()
```
## 结构类
## 行为类