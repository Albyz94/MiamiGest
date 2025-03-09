import express from "express";
import bodyParser from "body-parser";
import pg from 'pg';
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import 'dotenv/config';

const app = express();
const { Client } = pg
 
const db = new Client({
  user: "postgres", //process.env.PGUSER,
  password: "postgres",//process.env.PGPASS,
  host: "localhost",//process.env.PGHOST,
  port: 5432, //process.env.PGPORT,
  database: "miamigestdb" //process.env.PGDB,
})

app.use(cookieParser());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

app.set("view engine", "ejs");

db.connect(()=> {
    console.log("connected to pg")
    app.listen(3000, ()=> {
        console.log("server listening on 3000, https://localhost:3000");
    });
})


app.get("/", (req, res) => {
    editMode = false;
    if (req.cookies.isLogged === "true") {
        res.redirect("/home");
    } else {
        res.render("logpage");
    }


});

app.get("/inventario", (req, res) => {
    editMode=false;
    if (req.cookies.isLogged === "true") {
        res.render("inventary");
    } else {
        res.redirect("/");
    }
});

app.get("/registrati", (req, res)=> {
    res.render("register")
});


//Registration
app.post("/adduser" , async (req, res)=> {
    const user = req.body.user;
    const password = req.body.password;
    const email = req.body.email;
    let isRegistred = false;
     bcrypt.hash(password, 10, function (err, hash) {
         try {
            if (user && password && email) {
                isRegistred = true;
                db.query("INSERT INTO users (U_name, U_email,U_pass, U_type) VALUES ($1, $2, $3, 1)", [user, email, hash]);
            } else {
                isRegistred = false;
            }
    
          } catch (err) {
              console.error(err);
          }
        
     });
     
        res.redirect("/registrati");

});


//Login
app.post("/login", async (req, res)=> {
    const user = req.body.user;
    const password = req.body.password;

    //setting cookie to get usernames
    res.cookie("loggedUser", user);
    const toCompare = await db.query("SELECT u_pass FROM users where u_name= ($1)", [user]);

    if (toCompare.rows.length > 0) {
        try {
            const hash = toCompare.rows[0].u_pass;
            bcrypt.compare(password, hash, function(err, result) {
                if (result) {
                    res.cookie("isLogged", "true", {maxAge: 1000 * 60 * 60 * 24});
                        res.render("homepage", {luser:req.cookies.loggedUser });
                    } else {
                        console.log("username or password are wrong: not logged");
                        res.redirect("/");
                    }
                });

            } catch (error) {
                console.log(error);
            }
    } else {
        console.log("username or password are wrong")
    } 

});


app.post("/passchange", async (req, res)=> {
    //get data inserted in body for pass change
    const inputOldPass = req.body.oldpass;
    let inputNewPass = req.body.newpass;
    const inputConfPass = req.body.confpass;
    const loggedUser = req.cookies.loggedUser;

    //get data from db to conpare
    let dbOldPass = await db.query("SELECT u_pass FROM users where u_name = ($1)", [loggedUser]);
    const oldPass = dbOldPass.rows[0].u_pass;

    bcrypt.compare(inputOldPass, oldPass, function(err, result){
        console.log(inputOldPass, oldPass)
        if (result) {
            if (inputNewPass === inputConfPass) {
                bcrypt.hash(inputNewPass, 10, (err, hash)=> {
                    if (inputNewPass) {
                        const newPass = hash;
                        try {
                            db.query("UPDATE users SET u_pass = ($1) WHERE u_name = ($2)", [newPass, user]);
                            console.log("password updated");
                            res.redirect("/");
                        } catch (err) {
                            console.log(err);
                        }
                    } else {
                        console.log(err);
                    }
                });
            } else {
                console.log("confirmation and new password doesen't match")
            }
    }
});
    

});

app.get("/home", (req, res)=> {
    editMode = false;
    if (req.cookies.isLogged === "true") {
        res.render("homepage", {luser: req.cookies.loggedUser})
    } else {
        res.redirect("/");
    }

});

app.post("/logout", (req, res)=> {
    editMode = false;
    res.cookie("isLogged", "false");
    res.redirect("/");
});

//single order's array to manage elements
let orderBody = [];
//orders list array
let orderList = [];
let editMode = false;

app.get("/ordini", async (req, res) => {
    if (req.cookies.isLogged === "true") {
        const ordersResult = await db.query("SELECT * FROM orders");
        const arr = ordersResult.rows;
        const ordersList = arr.map((e)=>e.o_singleorder);
        const data = ordersList.map((order)=> JSON.parse(order));
        // console.log(data);
        // console.log(ordersResult);
        // console.log(arr.map((e)=> JSON.parse(e.o_singleorder)));
        res.render("orders", {orderBody, data, editMode, modOrderBody});
    } else {
        res.redirect("/");
    }
});

//Manage orders

app.post("/newOrder", (req, res, next)=> {

//Adding a new element to the array
    // retriving values from form
    const tavolo = req.body.tavolo;
    const coperti = req.body.coperti;
    const ordine = req.body.ordine;
    const addButton = req.body.listButton;
    //adding element in array
    if (addButton === "addFood") {
        orderBody.push(ordine);
    }
    res.redirect("/ordini");
});

//managing adding the single order
app.post("/addNewOrder", async (req, res, next)=> {
    //getting values from form
    const tav = req.body.tavolo;
    const coperti = req.body.coperti;
    const button = req.body.button;
    const date = new Date();
    const today = date.getDay() + "/" + date.getMonth()+1+"/"+date.getFullYear() + " " + date.getHours()+":"+date.getMinutes();
 
    //Managing buttons
    //adding object into db table
    if (button === "add") {
        const singleOrder = {tavolo: tav, cop: coperti, date:today,  ord: orderBody}
        orderList.push(singleOrder);
        // console.log(date)
        const nTavoli = await db.query("SELECT * FROM orders WHERE o_tavolo = ($1)", [tav]);
        if ((nTavoli.rows).length > 0) {
            console.log("C'è già un tavolo con lo stesso numero", (nTavoli.rows)[0].o_tavolo);
        } else {

            await db.query("INSERT INTO orders (O_singleorder, O_date, o_tavolo) values (($1), ($2), ($3))", [singleOrder, date, tav]);
        }
        
    } else {
        next();
    }
    //emptying array after adding
    orderBody=[];
    res.redirect("/ordini")
})

app.post("/orderList", (req, res)=> {
    //Deleting selected element
    const element = req.body.delButton;
    orderBody.splice(element, 1);
    res.redirect("/ordini");
});

let modOrderBody;
app.post("/orderActions", async (req, res)=> {
    const orderButton = req.body.orderButton;
    const nTav = orderButton.replace(/\D+/g, "") || 0; // Removes everything besides numbers
    const strTav = orderButton.replace(/delete/g, "");

    async function keepOrders(tav) {

            const copyQuery = await db.query("SELECT * FROM orders where o_tavolo = ($1)", [tav]);
            const data = copyQuery.rows[0];
            const delTavolo = data.o_tavolo;
            const delSingleOrder = data.o_singleorder;
            const delDate = data.o_date;
            await db.query("INSERT INTO del_orders (del_singleorder, del_date, del_tavolo) values (($1), ($2), ($3))", [delSingleOrder, delDate, delTavolo]);
            await db.query("DELETE FROM orders WHERE o_tavolo = ($1)", [tav]);
            // console.log(data);
    }

    if (orderButton === "edit"+nTav) {
        try {
            const query = await db.query("SELECT o_singleorder FROM orders where o_tavolo = ($1)", [nTav]);
            const qResult = query.rows;
            modOrderBody = JSON.parse(qResult[0].o_singleorder);
            editMode = true;

        } catch (err) {
            res.redirect("/ordini");
            console.log(err);
        }
        // console.log(modOrderBody);
    } else if (orderButton === "delete"+nTav) {
        keepOrders(nTav);
    } else {
        keepOrders(strTav);
    }
    res.redirect("/ordini");
});

app.post("/modify", async (req, res)=> {
    //getting values from form
    const mbutton = req.body.modifyButton;
    const mtav = req.body.mtavolo;
    const mcoperti = req.body.mcoperti;
    const mdate = new Date();
    const mtoday = mdate.getDay() + "/" + mdate.getMonth()+1+"/"+mdate.getFullYear() + " " + mdate.getHours()+":"+mdate.getMinutes();
    const tavolo = modOrderBody.tavolo;
    let orderElements = req.body.orderElement;
    const newElement = req.body.newElement;

    let singleOrder = {tavolo: mtav, cop: mcoperti, date:mtoday,  ord: orderElements}
    // if (mbutton === "add") {
    //     const elemnents = req.body.orderElement;
    //     orderElements.push(newElement);
    //     console.log(orderElements);
    //     // await db.query("UPDATE orders SET o_singleorder = ($1), o_date = ($2), o_tavolo = ($3) where o_tavolo = ($4)", [singleOrder, mdate, mtav, tavolo]);
    //     // orderElements.push(newElement);
    //     // await db.query("UPDATE orders o_singleorder = jsonb_set('o_singleorder', '{ord}', '($1)') WHERE o_tavolo = ($2)", [newElement, tavolo])
    //     console.log(newElement);

    // }

    if (mbutton === "confirm") {
        orderList.push(singleOrder);

        await db.query("UPDATE orders SET O_singleorder = ($1), O_date = ($2), o_tavolo = ($3) where o_tavolo = ($4) ", [singleOrder, mdate, mtav, tavolo ]);
        editMode = false;
    } else if(mbutton === "exit") {
        editMode = false;
    } 
    res.redirect("/ordini");
});

//Managing deleted orders
let deletedOrders;
app.get("/ordinidel", async (req, res)=> {
    const deletedData = await db.query("SELECT * FROM del_orders");
    deletedOrders = deletedData.rows;
    // const delOrderBody = JSON.parse(deletedData.rows[0].del_singleorder).ord;
    // console.log(JSON.parse(deletedData.rows[0].del_singleorder).ord);
    // console.log(deletedOrders);
    res.render("delorders", {deletedOrders});
})

app.post("/ordinidel", async (req, res)=> {
    res.redirect("/ordinidel");
});

app.post("/delOrder", async (req, res)=> {
    const delButton = req.body.delOrderButton;
    // console.log("button value", delButton);
    const nId = delButton.replace(/\D+/g, "") || 0; // Removes everything besides numbers
    // console.log("id", nId);
    // const strTav = delOrderButton.replace(/delete/g, "");
    if (delButton === "delete"+nId) {
        try {
            await db.query("DELETE FROM del_orders WHERE id = ($1)", [nId]);
        } catch (err) {
            console.log(err);
        }
    }
    res.redirect("/ordinidel")
});