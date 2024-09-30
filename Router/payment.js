const Payment = require("../Schema/payment");
const Customer = require("../Schema/customer")

function TimeZoneFormat(now) {
    let year = now.getFullYear()
    let month = now.getMonth() + 1
    let date = now.getDate() + 1
    now = `${year}-${month}-${date}`
    return now
}

function TimeZoneFormatOfNextDate(now) {
    let year = now.getFullYear()
    let month = now.getMonth() + 1
    let date = now.getDate() + 2
    now = `${year}-${month}-${date}`
    return now
}

function TimeMonth(now) {
    let year = now.getFullYear();
    let month = now.getMonth()+1;
    let date = "01";
    now = new Date(`${year}-${month}-${date}`);
    return now;
}

function TimeNextMonth(now) {
    let year = now.getFullYear();
    let month = now.getMonth()+2;
    let date = "01";
    now = new Date(`${year}-${month}-${date}`)
    return now;
}

exports.paymentAt = async(req,res) => {
    let {date} = req.body;
    try {
        if(!date) {
            let date = new Date();
            date = new Date(await TimeZoneFormat(date));
        }
        let nextDate = new Date(await TimeZoneFormatOfNextDate(new Date(date)));
        date = new Date(date);

        const UserPayment = await Payment.find({PAYMENT_DATE: {$gte: date, $lte: nextDate}});

        if(!UserPayment) {
            return res.status(200).json({user:`No user payment on that ${date}`})
        }

        let users = new Array();
        for(let user of UserPayment) {
            let tmp = await Customer.findOne({ID:user.CUSTOMER_PROFILE_ID});
            if(tmp) {
                let response = {
                    ID: tmp.ID,
                    NAME: tmp.NAME,
                    IMAGE: tmp.IMAGE_PATH,
                    PHONE: tmp.PHONE,
                    FEE: user.PAYMENT_AMOUNT,
                    PAYMENT_DATE: user.PAYMENT_DATE
                }

                users.push(response)
            }
        }
        if(!users) {
            return res.status(200).json({user:"No one payment on that date."})
        } 
        return res.status(200).json({user:users})
    }
    catch(err) {
        return res.status(500).json({status:"Internal Server Error."})
    }
}

exports.payment = async(req,res) => {
    let {id,type,amount,effective,end,balance} = req.body;
    if(!id || !type || !amount || !effective || !end || !balance) {
        return res.status(404).json({status:"All the fields are required like customer id, amount, payment type, effective date, end date and balance."})
    }

    try {
        let now = new Date();
        
        if(typeof(effective) === 'string') {
            effective = new Date(effective)
        }

        if(typeof(end) === "string") {
            end = new Date(end)
        }

        let thisMonth = TimeMonth(now);
        let PrevMonth = TimeNextMonth(now);
        
        let tmp = await Payment.find({CUSTOMER_PROFILE_ID:id, PAYMENT_DATE: { $gte: thisMonth, $lte: PrevMonth}});
        console.log(tmp.length) 
        if(tmp.length > 0) {
            return res.status(301).json({status:`So many payment added for this ${id}. So can't add for this user, but you can edit the detail of the user payment.`})
        }

        const pay = new Payment({
            CUSTOMER_PROFILE_ID: id,
            PAYMENT_TYPE: type,
            PAYMENT_AMOUNT: amount,
            EFFECTIVE_DATE: effective,
            END_DATE:end,
            PAYMENT_BALANCE:balance,
            PAYMENT_DATE: now
        });

        pay.save().then(() => {
            return res.status(200).json({status:`Payment added for this user ${id}`})
        }).catch((err) => {
            return res.status(500).json({status:"Internal Server Error", error:err})
        })
    }
    catch(err) {
        return res.status(500).json({status:"Internal Server Error", error: err})
    }
}

exports.paymentEdit = async(req,res) => {
    let {id,amount,end,balance} = req.body;
    if(!id || !amount || !end || balance===undefined) {
        return res.status(404).json({status:"All the fields are required like customer id, amount, payment type, effective date, end date and balance."})
    }

    try {
        let now = new Date();

        if(typeof(end) === "string") {
            end = new Date(end)
        }

        let thisMonth = TimeMonth(now);
        let PrevMonth = TimeNextMonth(now);

        let tmp = await Payment.find({CUSTOMER_PROFILE_ID:id, PAYMENT_DATE: { $gte: thisMonth, $lte: PrevMonth}});
        if(tmp.length==0) {
            return res.status(404).json({status:"No payment details"})
        }
        if(tmp.length > 1) {
            return res.status(301).json({status:`So many payment added for this ${id}. So can't edit for this user.`})
        }

        await Payment.findOneAndUpdate({CUSTOMER_PROFILE_ID:id, PAYMENT_DATE: { $gte: thisMonth, $lte: PrevMonth}}, { PAYMENT_AMOUNT: amount, END_DATE:end, PAYMENT_BALANCE:balance},{new:true})
        .then((data) => {
            return res.status(200).json({status:`Payment edited for this user ${id}`, payment: data})
        }).catch((err) => {
            return res.status(500).json({status:"Internal Server Error", error:err})
        })
    }
    catch(err) {
        return res.status(500).json({status:"Internal Server Error", error: err})
    }
}

exports.paymentOf = async(req,res) => {
    const {userID} = req.params;
    console.log(userID);
    let today = new Date();
    const payment = await Payment.find({CUSTOMER_PROFILE_ID:userID,
        $expr: {
            $and: [
                { $eq: [{ $month: "$PAYMENT_DATE" }, today.getMonth() + 1] },
                { $eq: [{ $year: "$PAYMENT_DATE" }, today.getFullYear()] }
            ]
        }
    })

    if(!payment)
        return res.status(404).json({status:"No payment on this month for the user."})
    return res.status(200).json({payment:payment});
}

exports.delPay = async(req,res) => {
    let {_id} = req.params;
    await Payment.findOneAndDelete({_id:_id}).then(() => {
        return res.status(200).json({status:"Deleted"})
    }).catch(() => {return res.status(500).json({status:"Internal Server Error"})})
}


exports.paymentOfAll = async(req,res) => {
    let {page,date} = req.query;
    page = page === undefined ? 0 : page*50;
    const customer = await Customer.find({},{PASSWORD:0},{skip:page,limit:50}).sort({ID:"asc"});
    let customers = new Array();
    try {
        let now = new Date();
        if(date) now = new Date(date);
        let thisMonth = TimeMonth(now);
        let PrevMonth = TimeNextMonth(now);
        for(let user of customer) {
            let pay = await Payment.findOne({CUSTOMER_PROFILE_ID:user.ID, PAYMENT_DATE: { $gte: thisMonth, $lte: PrevMonth}});
            if(pay) {
                let details = {
                    ID: user.ID,
                    NAME: user.NAME,
                    DOB: user.DOB,
                    PHONE: user.PHONE,
                    EMAIL: user.EMAIL,
                    ADDRESS: user.ADDRESS,
                    IMAGE_PATH: user.IMAGE_PATH,
                    PAYMENT_STATUS:"Paid",
                    PAYMENT_TYPE: pay?.PAYMENT_TYPE,
                    PAYMENT_AMOUNT: pay?.PAYMENT_AMOUNT,
                    EFFECTIVE_DATE: pay?.EFFECTIVE_DATE,
                    END_DATE: pay?.END_DATE,
                    PAYMENT_DATE: pay?.PAYMENT_DATE,
                    PAYMENT_BALANCE: pay?.PAYMENT_BALANCE
                }
                customers.push(details);
            }
            else {
                let details = {
                    ID: user.ID,
                    NAME: user.NAME,
                    DOB: user.DOB,
                    PHONE: user.PHONE,
                    EMAIL: user.EMAIL,
                    ADDRESS: user.ADDRESS,
                    IMAGE_PATH: user.IMAGE_PATH,
                    PAYMENT_STATUS:"Not paid"
                }
                customers.push(details);
            }
        }
        return res.status(200).json({customer:customers});
    }
    catch(e) {
        return res.status(500).json({status:"Something went wrong"});
    }
}